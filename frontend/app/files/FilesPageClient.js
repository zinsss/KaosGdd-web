"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
function formatBytes(value) { const size = Number(value || 0); if (!Number.isFinite(size) || size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`; return `${(size / (1024 * 1024)).toFixed(1)} MB`; }
export default function FilesPageClient() {
  const [items, setItems] = useState([]); const [isUploading, setIsUploading] = useState(false); const [error, setError] = useState("");
  async function loadFiles() { try { const res = await fetch("/api/files", { cache: "no-store" }); const data = await res.json(); setItems(data.items || []);} catch { setItems([]);} }
  useEffect(() => { loadFiles(); }, []);
  async function onUpload(event) {
    event.preventDefault(); const input = event.currentTarget.elements.namedItem("file"); const file = input?.files?.[0]; if (!file || isUploading) return;
    setIsUploading(true); setError("");
    try { const bytes = await file.arrayBuffer(); const res = await fetch("/api/files", { method: "POST", body: bytes, headers: { "x-file-name": file.name, "x-file-type": file.type || "application/octet-stream", "content-type": "application/octet-stream" } }); const data = await res.json().catch(() => null); if (!res.ok || !data?.ok) { setError((data && data.error) || "Upload failed."); return; } event.currentTarget.reset(); await loadFiles(); } catch { setError("Upload failed."); } finally { setIsUploading(false); }
  }
  return <main className="page"><section className="panel"><div className="sectionTitle">Files</div><form className="formRow" onSubmit={onUpload} style={{ marginBottom: 10 }}><input className="textInput" type="file" name="file" disabled={isUploading} /><button className="button compactButton" type="submit" disabled={isUploading}>{isUploading ? "..." : "Upload"}</button></form>{error ? <div className="errorText">{error}</div> : null}{items.length === 0 ? <div className="empty">No files.</div> : <ul className="taskList">{items.map((item) => <li key={item.id} className="taskListRow"><Link href={`/files/${item.id}`} className="taskLink taskListTitleLink">{item.original_filename || item.title}</Link><div className="metaLine">{item.mime_type || "application/octet-stream"} • {formatBytes(item.size_bytes)} • {item.created_at_display || item.created_at}</div></li>)}</ul>}</section></main>;
}
