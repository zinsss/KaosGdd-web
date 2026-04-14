"use client";

import { useState } from "react";
import { UI_STRINGS } from "../../lib/strings";

function excerpt(body) {
  const first = String(body || "").split(/\r?\n/).find((line) => line.trim());
  return first || "(empty)";
}

function JournalRow({ journal, expanded, onToggle }) {
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
    if (!res.ok || !data?.ok) return;
    window.location.reload();
  }

  return (
    <li className="taskListRow reminderListRow journalListRow">
      <button type="button" className="reminderRowButton" onClick={onToggle}>
        <div className="reminderListTopLine">
          <span className="reminderListWhen">{journal.created_at_display || journal.created_at || "-"}</span>
          <span className="reminderListTags">{journal.has_tags ? "#" : ""}</span>
        </div>
        <div className="reminderListTitleLine">
          <span className="reminderListType">[J]</span>
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

export default function JournalsPageClient({ items }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitle sectionTitleNoMargin">{UI_STRINGS.JOURNALS}</div>
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
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
