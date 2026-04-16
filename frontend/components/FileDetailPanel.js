"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FileRawEditor from "./FileRawEditor";
import LinkedItemsBlock from "./LinkedItemsBlock";

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDetailPanel({ item, raw }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  async function onRemove() {
    if (!window.confirm("Move this file to Removed?")) return;
    if (isRemoving) return;

    setIsRemoving(true);
    setRemoveError("");
    try {
      const res = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setRemoveError((data && data.error) || "File remove failed.");
        return;
      }
      router.push("/files");
      router.refresh();
    } catch {
      setRemoveError("File remove failed.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <main className="page">
      <div className="detailBackLinkRow"><Link className="taskLink backLink" href="/files">&lt; Back to Files</Link></div>

      <section className="panel">
        <div className="detailPageLabel">• File Detail</div>
        <div className="detailTitleRow">
          <div className="sectionTitle detailMainTitle">{item.title || item.original_filename}</div>
          <div className="detailStateText">{item.status}</div>
        </div>

        {item.tags?.length ? <div className="metaLine">{item.tags.map((tag) => `#${tag}`).join(" ")}</div> : null}

        <div className="detailReadBlock">
          <div className="detailReadRow"><div className="detailReadLabel">Original filename</div><div className="detailReadContent withDivider">{item.original_filename || "-"}</div></div>
          <div className="detailReadRow"><div className="detailReadLabel">Type</div><div className="detailReadContent withDivider">{item.mime_type || "application/octet-stream"}</div></div>
          <div className="detailReadRow"><div className="detailReadLabel">Size</div><div className="detailReadContent withDivider">{formatBytes(item.size_bytes)}</div></div>
          <div className="detailReadRow"><div className="detailReadLabel">Added</div><div className="detailReadContent withDivider">{item.created_at_display || item.created_at}</div></div>
          {item.updated_at_display ? <div className="detailReadRow"><div className="detailReadLabel">Updated</div><div className="detailReadContent withDivider">{item.updated_at_display}</div></div> : null}
          <div className="detailReadRow"><div className="detailReadLabel">Open / Download</div><div className="detailReadContent withDivider"><a className="taskLink" href={`/api/files/${item.id}/open`} target="_blank" rel="noreferrer">Open / Download</a></div></div>
          {item.memo ? <div className="detailReadRow"><div className="detailReadLabel">Memo</div><div className="detailReadContent detailReadMemo withDivider">{String(item.memo).split("\n").map((line, idx) => <div key={idx}>{line || "\u00A0"}</div>)}</div></div> : null}
          <LinkedItemsBlock links={item.links} />
        </div>
      </section>

      <section className="panel">
        <div className="actionRow detailActionRow">
          <button type="button" className={"button" + (showEdit ? " buttonActive" : "")} onClick={() => setShowEdit((v) => !v)}>Edit</button>
          <button type="button" className={"button" + (showMore ? " buttonActive" : "")} onClick={() => setShowMore((v) => !v)}>More</button>
        </div>
        {showEdit ? <div className="toggleBody"><FileRawEditor fileId={item.id} initialRaw={raw || ""} /></div> : null}
        {showMore ? (
          <div className="toggleBody moreMetaBox">
            <div className="metaStack">
              <div>created: {item.created_at_display || "-"}</div>
              <div>updated: {item.updated_at_display || "-"}</div>
              <div>item ID: {item.id}</div>
            </div>
            <div className="actionRow" style={{ marginTop: 12 }}>
              <button type="button" className="button" onClick={onRemove} disabled={isRemoving}>{isRemoving ? "..." : "Remove"}</button>
            </div>
            {removeError ? <div className="errorText">{removeError}</div> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
