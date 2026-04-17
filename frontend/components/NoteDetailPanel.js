"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import LinkedItemsBlock from "./LinkedItemsBlock";
import NoteRawEditor from "./NoteRawEditor";

export default function NoteDetailPanel({ item, raw }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  async function onRemove() {
    if (!window.confirm("Move this note to Removed?")) return;
    if (isRemoving) return;

    setIsRemoving(true);
    setRemoveError("");
    try {
      const res = await fetch(`/api/notes/${item.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setRemoveError((data && data.error) || "Note remove failed.");
        return;
      }
      router.push("/notes");
      router.refresh();
    } catch {
      setRemoveError("Note remove failed.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <main className="page">
      <div className="detailBackLinkRow"><Link className="taskLink backLink" href="/notes">&lt; Back to Notes</Link></div>

      <section className="panel">
        <div className="detailPageLabel">• Note Detail</div>
        <div className="detailTitleRow">
          <div className="sectionTitle detailMainTitle">{item.title || "Untitled note"}</div>
          <div className="detailStateText">{item.status}</div>
        </div>

        {item.tags?.length ? <div className="metaLine">{item.tags.map((tag) => `#${tag}`).join(" ")}</div> : null}

        <div className="detailReadBlock">
          <div className="detailReadRow">
            <div className="detailReadLabel">Document</div>
            <div className="detailReadContent withDivider" style={{ width: "100%" }}>
              <div className="markdownBody">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body || ""}</ReactMarkdown>
              </div>
            </div>
          </div>

          <LinkedItemsBlock links={item.links} />

          {/* TODO(notes-v0-freeze): persist markdown checklist toggle state in read mode. */}
        </div>
      </section>

      <section className="panel">
        <div className="actionRow detailActionRow">
          <button type="button" className={"button" + (showEdit ? " buttonActive" : "")} onClick={() => setShowEdit((v) => !v)}>Edit</button>
          <button type="button" className={"button" + (showMore ? " buttonActive" : "")} onClick={() => setShowMore((v) => !v)}>More</button>
        </div>
        {showEdit ? <div className="toggleBody"><NoteRawEditor noteId={item.id} initialRaw={raw || ""} /></div> : null}
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
