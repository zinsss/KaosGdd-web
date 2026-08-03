from __future__ import annotations

import importlib.util
from pathlib import Path


HOOK_PATH = Path(__file__).parents[1] / "scripts" / "hylafax_recv_hook.py"


def load_hook_module():
    spec = importlib.util.spec_from_file_location("hylafax_recv_hook", HOOK_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_upload_mode_sends_tiff_bytes_and_metadata(tmp_path: Path, monkeypatch) -> None:
    hook = load_hook_module()
    source = tmp_path / "received fax.tif"
    source.write_bytes(b"II*\x00fax")
    monkeypatch.setenv("KAOSGDD_API_BASE", "http://127.0.0.1:18000")
    monkeypatch.setenv("KAOSGDD_FAX_TRANSFER_MODE", "upload")

    request = hook.build_request(str(source), "0541234567", "ttyACM0")

    assert request.full_url == "http://127.0.0.1:18000/fax/incoming-upload"
    assert request.data == b"II*\x00fax"
    assert request.get_header("Content-type") == "image/tiff"
    assert request.get_header("X-file-name-url") == "received%20fax.tif"
    assert request.get_header("X-fax-remote-number") == "0541234567"
    assert request.get_header("X-fax-local-device") == "ttyACM0"


def test_path_mode_remains_the_default(tmp_path: Path, monkeypatch) -> None:
    hook = load_hook_module()
    source = tmp_path / "received.tif"
    source.write_bytes(b"II*\x00fax")
    monkeypatch.delenv("KAOSGDD_FAX_TRANSFER_MODE", raising=False)

    request = hook.build_request(str(source), "", "ttyACM0")

    assert request.full_url.endswith("/fax/incoming")
    assert request.get_header("Content-type") == "application/json"
