"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const INITIAL_RENDER_COUNT = 2;
const LOAD_BATCH_SIZE = 2;

function PdfPageCanvas({ pdfRef, pageNumber, shouldRender, renderTasksRef }) {
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

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTasksRef.current.set(pageNumber, renderTask);
      try {
        await renderTask.promise;
      } finally {
        renderTasksRef.current.delete(pageNumber);
      }
    }

    renderPage().catch(() => {});

    return () => {
      cancelled = true;
      const activeTask = renderTasksRef.current.get(pageNumber);
      if (activeTask) {
        activeTask.cancel();
        renderTasksRef.current.delete(pageNumber);
      }
    };
  }, [pageNumber, pdfRef, shouldRender, renderTasksRef]);

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "#fff", padding: 4 }}>
      <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
}

export default function PdfPreviewClient({ fileId }) {
  const pdfRef = useRef(null);
  const loadingTaskRef = useRef(null);
  const renderTasksRef = useRef(new Map());
  const sentinelRef = useRef(null);

  const [numPages, setNumPages] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const response = await fetch(`/api/files/${fileId}/preview`, { cache: "no-store" });
        const data = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true });
        loadingTaskRef.current = loadingTask;
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

      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }

      renderTasksRef.current.forEach((task) => task.cancel());
      renderTasksRef.current.clear();

      if (pdfRef.current) {
        pdfRef.current.destroy();
        pdfRef.current = null;
      }
    };
  }, [fileId]);

  useEffect(() => {
    if (!sentinelRef.current || !numPages || renderCount >= numPages) return;

    const node = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setRenderCount((current) => Math.min(current + LOAD_BATCH_SIZE, numPages));
        }
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
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
          renderTasksRef={renderTasksRef}
        />
      ))}

      {renderCount < numPages ? (
        <>
          <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
          <button type="button" className="button" onClick={() => setRenderCount((current) => Math.min(current + LOAD_BATCH_SIZE, numPages))}>
            Load more pages
          </button>
        </>
      ) : null}
    </div>
  );
}
