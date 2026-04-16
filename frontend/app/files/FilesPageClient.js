"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function formatBytes(value) {
  const size = Number(value || 0);

  if (!Number.isFinite(size) || size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildUploadErrorMessage(response, data, parseFailed) {
  if (data && typeof data.error === "string" && data.error.trim()) {
    const trimmed = data.error.trim();
    const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(trimmed);
    if (!hasKorean) {
      return trimmed;
    }
  }

  if (!response.ok) {
    return `Upload failed: ${response.status}`;
  }

  if (parseFailed) {
    return "Upload failed: malformed response";
  }

  return "Upload failed.";
}

export default function FilesPageClient() {
  const [items, setItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadDebug, setUploadDebug] = useState("");

  async function loadFiles() {
    try {
      const res = await fetch("/api/files", { cache: "no-store" });
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function onUpload(event) {
    event.preventDefault();

    if (isUploading) {
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem("file");
    const file = input?.files?.[0];

    if (!file) {
      setError("No file selected.");
      setUploadDebug("No file selected before submit.");
      return;
    }

    console.log("[FilesPageClient] Upload start");
    console.log("[FilesPageClient] Selected file", {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    });

    setIsUploading(true);
    setError("");
    setUploadDebug("");

    try {
      const bytes = await file.arrayBuffer();
      const res = await fetch("/api/files", {
        method: "POST",
        body: bytes,
        headers: {
          "x-file-name": file.name,
          "x-file-type": file.type || "application/octet-stream",
          "content-type": "application/octet-stream",
        },
      });

      console.log("[FilesPageClient] Upload response status", res.status);

      let data = null;
      let parseFailed = false;

      try {
        data = await res.json();
        console.log("[FilesPageClient] Upload response body", data);
      } catch {
        parseFailed = true;
        console.log("[FilesPageClient] Upload response parse failure");
      }

      if (!res.ok || !data?.ok) {
        const message = buildUploadErrorMessage(res, data, parseFailed);
        setError(message);
        setUploadDebug(`status=${res.status}, parsed=${parseFailed ? "no" : "yes"}`);
        return;
      }

      form.reset();
      await loadFiles();
    } catch (uploadError) {
      const reason =
        uploadError instanceof Error && uploadError.message
          ? uploadError.message
          : "backend unreachable";

      console.log("[FilesPageClient] Upload request failed", uploadError);
      setError(`Upload failed: ${reason}`);
      setUploadDebug("request threw before valid response");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitle">Files</div>

        <form className="formRow" onSubmit={onUpload} style={{ marginBottom: 10 }}>
          <input className="textInput" type="file" name="file" disabled={isUploading} />
          <button className="button compactButton" type="submit" disabled={isUploading}>
            {isUploading ? "..." : "Upload"}
          </button>
        </form>

        {error ? <div className="errorText">{error}</div> : null}
        {uploadDebug ? <div className="metaLine">Debug: {uploadDebug}</div> : null}

        {items.length === 0 ? (
          <div className="empty">No files.</div>
        ) : (
          <ul className="taskList">
            {items.map((item) => (
              <li key={item.id} className="taskListRow">
                <Link href={`/files/${item.id}`} className="taskLink taskListTitleLink">
                  {item.title || item.original_filename}
                </Link>
                <div className="metaLine">
                  {item.original_filename || "-"} • {item.mime_type || "application/octet-stream"} • {formatBytes(item.size_bytes)} •{" "}
                  {item.created_at_display || item.created_at}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
