"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PDFJS_LOCAL_MODULE = "/vendor/pdfjs/pdf.min.mjs";
const PDFJS_LOCAL_WORKER = "/vendor/pdfjs/pdf.worker.min.mjs";
const INITIAL_RENDER_COUNT = 2;
const RENDER_BATCH_SIZE = 2;

function PdfPageCanvas({ pdfRef, pageNumber, shouldRender }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!shouldRender || !pdfRef.current || !canvasRef.current) return;
    let cancelled = false;

    async function renderPage() {
      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || cancelled) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
    }

    renderPage().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pdfRef, pageNumber, shouldRender]);

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "#fff", padding: 4 }}>
      <canvas
        ref={canvasRef}
        aria-label={`PDF page ${pageNumber}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </div>
  );
}

export default function PdfPreviewClient({ fileId }) {
  const pdfRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjsLib = await import(/* webpackIgnore: true */ PDFJS_LOCAL_MODULE);
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_LOCAL_WORKER;

        const loadingTask = pdfjsLib.getDocument(`/api/files/${fileId}/preview`);
        const pdf = await loadingTask.promise;

        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setRenderCount(Math.min(INITIAL_RENDER_COUNT, pdf.numPages));
        setLoading(false);
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

  useEffect(() => {
    if (!numPages || renderCount >= numPages) return;
    const timer = window.setTimeout(() => {
      setRenderCount((current) => Math.min(current + RENDER_BATCH_SIZE, numPages));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [renderCount, numPages]);

  const pageNumbers = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  if (loading) return <div className="detailReadContent withDivider">Loading PDF preview…</div>;
  if (error) return <div className="errorText">{error}</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {pageNumbers.map((pageNumber) => (
        <PdfPageCanvas
          key={pageNumber}
          pdfRef={pdfRef}
          pageNumber={pageNumber}
          shouldRender={pageNumber <= renderCount}
        />
      ))}
    </div>
  );
}
