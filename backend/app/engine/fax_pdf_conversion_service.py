from __future__ import annotations

import mimetypes
import os
import shutil
import subprocess
import tempfile
import zlib
from pathlib import Path
from uuid import uuid4


class FaxConversionError(Exception):
    pass


class FaxPdfConversionService:
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    TIFF_EXTENSIONS = {".tif", ".tiff"}
    DOCUMENT_EXTENSIONS = {".doc", ".docx", ".odt", ".txt", ".rtf"}

    def __init__(self, *, storage_dir: str, run_command=None) -> None:
        self.storage_dir = storage_dir
        self.run_command = run_command or subprocess.run

    def convert_to_pdf(
        self,
        *,
        input_path: str,
        original_filename: str | None = None,
        mime_type: str | None = None,
    ) -> str:
        source = Path(input_path)
        if not source.is_file():
            raise FaxConversionError("Fax source file does not exist.")

        os.makedirs(self.storage_dir, exist_ok=True)
        output_path = Path(self.storage_dir) / f"{uuid4().hex}.pdf"
        suffix = Path(str(original_filename or source.name)).suffix.lower()
        detected_mime = str(mime_type or "").strip() or mimetypes.guess_type(str(original_filename or source.name))[0] or ""

        if detected_mime == "application/pdf" or suffix == ".pdf":
            shutil.copyfile(source, output_path)
            self._verify_pdf(output_path)
            return str(output_path)

        if suffix in self.TIFF_EXTENSIONS or detected_mime in {"image/tiff", "image/tif"}:
            self._run_tiff_to_pdf(source, output_path)
            self._verify_pdf(output_path)
            return str(output_path)

        if suffix == ".hwp":
            raise FaxConversionError("HWP to PDF conversion is not available on this server.")

        if suffix in {".jpg", ".jpeg"} or detected_mime == "image/jpeg":
            self._write_jpeg_pdf(source, output_path)
            self._verify_pdf(output_path)
            return str(output_path)

        if suffix == ".png" or detected_mime == "image/png":
            self._write_png_pdf(source, output_path)
            self._verify_pdf(output_path)
            return str(output_path)

        if suffix == ".webp" or detected_mime == "image/webp":
            self._run_webp_to_pdf(source, output_path)
            self._verify_pdf(output_path)
            return str(output_path)

        if suffix in self.DOCUMENT_EXTENSIONS:
            self._run_libreoffice_to_pdf(source, output_path)
            self._verify_pdf(output_path)
            return str(output_path)

        if suffix in self.IMAGE_EXTENSIONS or detected_mime.startswith("image/"):
            raise FaxConversionError("Unsupported image format for fax PDF conversion.")

        raise FaxConversionError("Unsupported fax document format.")

    def _run_tiff_to_pdf(self, source: Path, output_path: Path) -> None:
        if not shutil.which("tiff2pdf"):
            raise FaxConversionError("TIFF to PDF conversion is not available on this server.")
        result = self.run_command(
            ["tiff2pdf", "-o", str(output_path), str(source)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            self._remove_partial(output_path)
            reason = (result.stderr or result.stdout or "").strip()
            raise FaxConversionError(reason or "TIFF to PDF conversion failed.")

    def _run_webp_to_pdf(self, source: Path, output_path: Path) -> None:
        if not shutil.which("dwebp"):
            raise FaxConversionError("WEBP to PDF conversion requires dwebp.")
        with tempfile.TemporaryDirectory() as tmp_dir:
            png_path = Path(tmp_dir) / "source.png"
            result = self.run_command(
                ["dwebp", str(source), "-o", str(png_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                reason = (result.stderr or result.stdout or "").strip()
                raise FaxConversionError(reason or "WEBP to PNG conversion failed.")
            self._write_png_pdf(png_path, output_path)

    def _run_libreoffice_to_pdf(self, source: Path, output_path: Path) -> None:
        office_bin = shutil.which("libreoffice") or shutil.which("soffice")
        if not office_bin:
            raise FaxConversionError("Document to PDF conversion requires LibreOffice.")
        with tempfile.TemporaryDirectory() as tmp_dir:
            result = self.run_command(
                [
                    office_bin,
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tmp_dir,
                    str(source),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            converted = Path(tmp_dir) / f"{source.stem}.pdf"
            if result.returncode != 0 or not converted.is_file():
                reason = (result.stderr or result.stdout or "").strip()
                raise FaxConversionError(reason or "Document to PDF conversion failed.")
            shutil.copyfile(converted, output_path)

    def _write_jpeg_pdf(self, source: Path, output_path: Path) -> None:
        data = source.read_bytes()
        width, height = self._jpeg_dimensions(data)
        self._write_image_pdf(
            output_path,
            image_data=data,
            width=width,
            height=height,
            color_space="/DeviceRGB",
            bits_per_component=8,
            image_filter="/DCTDecode",
            decode_parms=None,
        )

    def _write_png_pdf(self, source: Path, output_path: Path) -> None:
        width, height, color_space, colors, bits_per_component, compressed = self._png_image_payload(source.read_bytes())
        self._write_image_pdf(
            output_path,
            image_data=compressed,
            width=width,
            height=height,
            color_space=color_space,
            bits_per_component=bits_per_component,
            image_filter="/FlateDecode",
            decode_parms=f"<< /Predictor 15 /Colors {colors} /BitsPerComponent {bits_per_component} /Columns {width} >>",
        )

    def _write_image_pdf(
        self,
        output_path: Path,
        *,
        image_data: bytes,
        width: int,
        height: int,
        color_space: str,
        bits_per_component: int,
        image_filter: str,
        decode_parms: str | None,
    ) -> None:
        page_width = max(1, width)
        page_height = max(1, height)
        image_dict = (
            f"<< /Type /XObject /Subtype /Image /Width {width} /Height {height} "
            f"/ColorSpace {color_space} /BitsPerComponent {bits_per_component} "
            f"/Filter {image_filter} "
        )
        if decode_parms:
            image_dict += f"/DecodeParms {decode_parms} "
        image_dict += f"/Length {len(image_data)} >>"
        content = f"q\n{page_width} 0 0 {page_height} 0 0 cm\n/Im0 Do\nQ\n".encode("ascii")
        objects = [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"
            ).encode("ascii"),
            image_dict.encode("ascii") + b"\nstream\n" + image_data + b"\nendstream",
            f"<< /Length {len(content)} >>".encode("ascii") + b"\nstream\n" + content + b"endstream",
        ]
        self._write_pdf_objects(output_path, objects)

    def _write_pdf_objects(self, output_path: Path, objects: list[bytes]) -> None:
        offsets = [0]
        with output_path.open("wb") as handle:
            handle.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
            for index, obj in enumerate(objects, start=1):
                offsets.append(handle.tell())
                handle.write(f"{index} 0 obj\n".encode("ascii"))
                handle.write(obj)
                handle.write(b"\nendobj\n")
            xref_at = handle.tell()
            handle.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
            handle.write(b"0000000000 65535 f \n")
            for offset in offsets[1:]:
                handle.write(f"{offset:010d} 00000 n \n".encode("ascii"))
            handle.write(
                (
                    f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                    f"startxref\n{xref_at}\n%%EOF\n"
                ).encode("ascii")
            )

    def _jpeg_dimensions(self, data: bytes) -> tuple[int, int]:
        if len(data) < 4 or data[:2] != b"\xff\xd8":
            raise FaxConversionError("Invalid JPEG image.")
        idx = 2
        while idx < len(data):
            while idx < len(data) and data[idx] == 0xFF:
                idx += 1
            if idx >= len(data):
                break
            marker = data[idx]
            idx += 1
            if marker in {0xD8, 0xD9}:
                continue
            if idx + 2 > len(data):
                break
            segment_length = int.from_bytes(data[idx : idx + 2], "big")
            if segment_length < 2 or idx + segment_length > len(data):
                break
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                if segment_length < 7:
                    break
                height = int.from_bytes(data[idx + 3 : idx + 5], "big")
                width = int.from_bytes(data[idx + 5 : idx + 7], "big")
                components = data[idx + 7]
                if components != 3:
                    raise FaxConversionError("Only RGB JPEG fax conversion is supported.")
                return width, height
            idx += segment_length
        raise FaxConversionError("Could not read JPEG dimensions.")

    def _png_image_payload(self, data: bytes) -> tuple[int, int, str, int, int, bytes]:
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise FaxConversionError("Invalid PNG image.")
        idx = 8
        width = height = bit_depth = color_type = None
        idat_parts: list[bytes] = []
        while idx + 8 <= len(data):
            length = int.from_bytes(data[idx : idx + 4], "big")
            chunk_type = data[idx + 4 : idx + 8]
            chunk_data = data[idx + 8 : idx + 8 + length]
            idx += 12 + length
            if chunk_type == b"IHDR":
                width = int.from_bytes(chunk_data[0:4], "big")
                height = int.from_bytes(chunk_data[4:8], "big")
                bit_depth = chunk_data[8]
                color_type = chunk_data[9]
                compression = chunk_data[10]
                filter_method = chunk_data[11]
                interlace = chunk_data[12]
                if compression != 0 or filter_method != 0 or interlace != 0:
                    raise FaxConversionError("Unsupported PNG encoding for fax PDF conversion.")
            elif chunk_type == b"IDAT":
                idat_parts.append(chunk_data)
            elif chunk_type == b"IEND":
                break
        if width is None or height is None or bit_depth is None or color_type is None or not idat_parts:
            raise FaxConversionError("Invalid PNG image.")
        if bit_depth != 8:
            raise FaxConversionError("Only 8-bit PNG fax conversion is supported.")
        if color_type == 0:
            return width, height, "/DeviceGray", 1, bit_depth, b"".join(idat_parts)
        if color_type == 2:
            return width, height, "/DeviceRGB", 3, bit_depth, b"".join(idat_parts)
        if color_type in {4, 6}:
            return self._png_alpha_to_rgb_pdf_payload(width, height, color_type, b"".join(idat_parts))
        raise FaxConversionError("Unsupported PNG color type for fax PDF conversion.")

    def _png_alpha_to_rgb_pdf_payload(self, width: int, height: int, color_type: int, compressed: bytes) -> tuple[int, int, str, int, int, bytes]:
        channels = 4 if color_type == 6 else 2
        raw = zlib.decompress(compressed)
        stride = width * channels
        rows = []
        previous = bytearray(stride)
        idx = 0
        for _ in range(height):
            filter_type = raw[idx]
            idx += 1
            scanline = bytearray(raw[idx : idx + stride])
            idx += stride
            self._unfilter_png_scanline(scanline, previous, filter_type, channels)
            if color_type == 6:
                rgb = bytearray()
                for pixel in range(width):
                    base = pixel * 4
                    rgb.extend(scanline[base : base + 3])
            else:
                rgb = bytearray(scanline[pixel * 2] for pixel in range(width))
            rows.append(b"\x00" + bytes(rgb))
            previous = scanline
        colors = 3 if color_type == 6 else 1
        color_space = "/DeviceRGB" if color_type == 6 else "/DeviceGray"
        return width, height, color_space, colors, 8, zlib.compress(b"".join(rows))

    def _unfilter_png_scanline(self, scanline: bytearray, previous: bytearray, filter_type: int, channels: int) -> None:
        for i in range(len(scanline)):
            left = scanline[i - channels] if i >= channels else 0
            up = previous[i] if previous else 0
            upper_left = previous[i - channels] if previous and i >= channels else 0
            if filter_type == 0:
                value = scanline[i]
            elif filter_type == 1:
                value = scanline[i] + left
            elif filter_type == 2:
                value = scanline[i] + up
            elif filter_type == 3:
                value = scanline[i] + ((left + up) // 2)
            elif filter_type == 4:
                value = scanline[i] + self._png_paeth(left, up, upper_left)
            else:
                raise FaxConversionError("Unsupported PNG filter for fax PDF conversion.")
            scanline[i] = value & 0xFF

    def _png_paeth(self, left: int, up: int, upper_left: int) -> int:
        p = left + up - upper_left
        pa = abs(p - left)
        pb = abs(p - up)
        pc = abs(p - upper_left)
        if pa <= pb and pa <= pc:
            return left
        if pb <= pc:
            return up
        return upper_left

    def _verify_pdf(self, path: Path) -> None:
        if not path.is_file() or path.stat().st_size <= 0:
            self._remove_partial(path)
            raise FaxConversionError("Converted PDF is empty.")
        with path.open("rb") as handle:
            header = handle.read(5)
        if header != b"%PDF-":
            self._remove_partial(path)
            raise FaxConversionError("Converted fax document is not a valid PDF.")

    def _remove_partial(self, path: Path) -> None:
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass
