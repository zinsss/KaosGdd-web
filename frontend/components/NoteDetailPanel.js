"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import LinkedItemsBlock from "./LinkedItemsBlock";
import NoteRawEditor from "./NoteRawEditor";

function toggleChecklistLine(markdownBody, checklistIndex, nextChecked) {
  const lines = String(markdownBody || "").split("\n");
  let found = -1;

  const next = lines.map((line) => {
    const match = line.match(/^(\s*[-*+]\s+\[)( |x|X)(\]\s.*)$/);
    if (!match) return line;

    found += 1;
    if (found !== checklistIndex) return line;

    return `${match[1]}${nextChecked ? "x" : " "}${match[3]}`;
  });

  return next.join("\n");
}

function buildRawFromParts({ title, tags, links, body }) {
  const tagLine = (tags || []).join(", ");
  const linkLine = (links || []).map((link) => link.id).join(", ");
  const lines = [":::", `title: ${title || ""}`.trimEnd(), `tags: ${tagLine}`.trimEnd(), `link: ${linkLine}`.trimEnd(), ":::"];

  const cleanBody = String(body || "").trimEnd();
  if (cleanBody) {
    lines.push("");
    lines.push(cleanBody);
  }
  return lines.join("\n");
}

export default function NoteDetailPanel({ item, raw }) {
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [body, setBody] = useState(item.body || "");
  const [checklistError, setChecklistError] = useState("");
  const [isChecklistSaving, setIsChecklistSaving] = useState(false);

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

  async function onToggleChecklist(checklistIndex, nextChecked) {
    if (isChecklistSaving) return;

    const nextBody = toggleChecklistLine(body, checklistIndex, nextChecked);
    if (nextBody === body) return;

    const nextRaw = buildRawFromParts({
      title: item.title,
      tags: item.tags || [],
      links: item.links || [],
      body: nextBody,
    });

    setChecklistError("");
    setIsChecklistSaving(true);
    try {
      const res = await fetch(`/api/notes/${item.id}/raw`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: nextRaw }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setChecklistError((data && data.error) || "Checklist update failed.");
        return;
      }
      setBody(nextBody);
      router.refresh();
    } catch {
      setChecklistError("Checklist update failed.");
    } finally {
      setIsChecklistSaving(false);
    }
  }

  let checkboxIndex = -1;

  return (
    <main className="page">
      <div className="detailBackLinkRow"><Link className="taskLink backLink" href="/notes">&lt; Back to Notes</Link></div>

      <section className="panel">
        <div className="detailPageLabel">• Note Detail</div>
        <div className="detailStateText">{item.status}</div>

        <div className="detailReadBlock">
          <div className="detailReadRow">
            <div className="detailReadLabel">Title</div>
            <div className="detailReadContent withDivider">{item.title || "Untitled note"}</div>
          </div>

          <div className="detailReadRow">
            <div className="detailReadLabel">Tags</div>
            <div className="detailReadContent withDivider">
              {item.tags?.length ? item.tags.map((tag) => `#${tag}`).join(" ") : "-"}
            </div>
          </div>

          <div className="detailBodyBlock">
            <div className="markdownBody">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  input(props) {
                    if (props.type !== "checkbox") {
                      return <input type={props.type} readOnly />;
                    }

                    checkboxIndex += 1;
                    const currentIndex = checkboxIndex;
                    return (
                      <input
                        type="checkbox"
                        checked={Boolean(props.checked)}
                        disabled={isChecklistSaving}
                        onChange={(event) => onToggleChecklist(currentIndex, event.target.checked)}
                      />
                    );
                  },
                }}
              >
                {body}
              </ReactMarkdown>
            </div>
          </div>

          {checklistError ? <div className="errorText">{checklistError}</div> : null}
          <LinkedItemsBlock links={item.links} />
        </div>
      </section>

      <section className="panel">
        <div className="actionRow detailActionRow">
          <button type="button" className={"button" + (openPanel === "edit" ? " buttonActive" : "")} onClick={() => setOpenPanel((current) => (current === "edit" ? null : "edit"))}>Edit</button>
          <button type="button" className={"button" + (openPanel === "more" ? " buttonActive" : "")} onClick={() => setOpenPanel((current) => (current === "more" ? null : "more"))}>More</button>
        </div>
        {openPanel === "edit" ? <div className="toggleBody"><NoteRawEditor noteId={item.id} initialRaw={raw || ""} /></div> : null}
        {openPanel === "more" ? (
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
