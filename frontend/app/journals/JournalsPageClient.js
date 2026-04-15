"use client";

import { useEffect, useState } from "react";
import { UI_STRINGS } from "../../lib/strings";

function excerpt(body) {
  const first = String(body || "").split(/\r?\n/).find((line) => line.trim());
  return first || "(empty)";
}

function JournalRow({ journal, expanded, onToggle, onDeleted, onActionError }) {
  const tags = (journal.tags || []).map((tag) => `#${tag}`).join(" ");

  function startEdit() {
    fetch(`/api/journals/${journal.id}/raw`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok || !data.raw) return;
        window.dispatchEvent(
          new CustomEvent("kaosgdd:start-journal-edit", {
            detail: { id: journal.id, raw: data.raw, kind: "journal" },
          }),
        );
      })
      .catch(() => {});
  }

  async function removeJournal() {
    const res = await fetch(`/api/journals/${journal.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      onActionError((data && data.error) || "Journal remove failed.");
      return;
    }
    onDeleted(journal.id);
  }

  return (
    <li className="taskListRow reminderListRow journalListRow">
      <button type="button" className="reminderRowButton" onClick={onToggle}>
        <div className="reminderListTopLine">
          <span className="reminderListWhen">{journal.created_at_display || journal.created_at || "-"}</span>
          <span className="reminderListTags">{journal.has_tags ? "#" : ""}</span>
        </div>
        <div className="reminderListTitleLine">
          <span className="reminderListTitleText">{excerpt(journal.body)}</span>
        </div>
      </button>

      {expanded ? (
        <div className="reminderExpandArea journalExpandArea">
          <div className="journalMetaLine">created {journal.created_at_display || journal.created_at || "-"}</div>
          <pre className="journalBody">{journal.body || ""}</pre>
          {tags ? <div className="journalTags">{tags}</div> : null}
          <div className="actionRow reminderExpandActions">
            <button type="button" className="button compactButton" onClick={startEdit}>
              Raw edit
            </button>
            <button type="button" className="button compactButton" onClick={removeJournal}>
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function JournalsPageClient() {
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setLocalError("");
    fetch("/api/journals", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load journals.");
        }
        setItems(data?.items || []);
      })
      .catch((err) => {
        setItems([]);
        setLocalError(err?.message || "Failed to load journals.");
      });
  }, []);

  function removeRow(id) {
    setItems((current) => current.filter((journal) => journal.id !== id));
    setExpandedId((current) => (current === id ? null : current));
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">
            <span className="sectionModuleName">{UI_STRINGS.JOURNALS}</span>
            <span className="sectionSeparator"> • </span>
            <span className="sectionContextActive">Stream</span>
          </div>
        </div>

        {localError ? <div className="errorText">{localError}</div> : null}

        {items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_JOURNALS}</div>
        ) : (
          <ul className="taskList reminderCompactList">
            {items.map((journal) => (
              <JournalRow
                key={journal.id}
                journal={journal}
                expanded={expandedId === journal.id}
                onToggle={() => setExpandedId(expandedId === journal.id ? null : journal.id)}
                onDeleted={removeRow}
                onActionError={setLocalError}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
