"use client";

import { useEffect, useState } from "react";

const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

export default function PdfPreviewClient({ fileId, title }) {
  const [pages, setPages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjsLib = await import(/* webpackIgnore: true */ PDFJS_CDN);
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;

        const loadingTask = pdfjsLib.getDocument(`/api/files/${fileId}/preview`);
        const pdf = await loadingTask.promise;
        const renderedPages = [];

        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          if (!context) throw new Error("Unable to render PDF page.");
          await page.render({ canvasContext: context, viewport }).promise;
          renderedPages.push({ index: i, dataUrl: canvas.toDataURL("image/png") });
        }

        if (!cancelled) {
          setPages(renderedPages);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF preview.");
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (loading) return <div className="detailReadContent withDivider">Loading PDF preview…</div>;
  if (error) return <div className="errorText">{error}</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {pages.map((page) => (
        <img
          key={page.index}
          src={page.dataUrl}
          alt={`${title} - page ${page.index}`}
          style={{ width: "100%", height: "auto", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }}
        />
      ))}
    </div>
  );
}
