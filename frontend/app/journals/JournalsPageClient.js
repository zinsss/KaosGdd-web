"use client";

import { useEffect, useState } from "react";
import { UI_STRINGS } from "../../lib/strings";

function resolveMonthKey(journal) {
  const raw = String(journal?.created_at || "");
  const direct = raw.match(/^(\d{4}-\d{2})/);
  if (direct) return direct[1];

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return "unknown";
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function groupByMonth(items) {
  const map = new Map();
  for (const journal of items) {
    const month = resolveMonthKey(journal);
    if (!map.has(month)) map.set(month, []);
    map.get(month).push(journal);
  }
  return Array.from(map.entries())
    .map(([month, journals]) => ({ month, journals }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

function JournalRow({ journal, expanded, onToggle, onDeleted, onActionError }) {
  const tags = (journal.tags || []).map((tag) => `#${tag}`).join(" ");
  const tagHint = tags ? `tagged ${tags}` : "";

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
          <span className="reminderListTags journalTagHint">{tagHint}</span>
        </div>
        <div className="reminderListTitleLine">
          <span className="reminderListTitleText journalBodyInline">{journal.body || "(empty)"}</span>
        </div>
      </button>

      {expanded ? (
        <div className="reminderExpandArea journalExpandArea">
          <div className="journalMetaLine">created {journal.created_at_display || journal.created_at || "-"}</div>
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
  const [expandedMonths, setExpandedMonths] = useState({});
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setLocalError("");
    fetch("/api/journals", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load journals.");
        }
        const nextItems = data?.items || [];
        setItems(nextItems);
        const openMonth = currentMonthKey();
        const monthState = {};
        for (const group of groupByMonth(nextItems)) {
          monthState[group.month] = group.month === openMonth;
        }
        setExpandedMonths(monthState);
      })
      .catch((err) => {
        setItems([]);
        setExpandedMonths({});
        setLocalError(err?.message || "Failed to load journals.");
      });
  }, []);

  function removeRow(id) {
    setItems((current) => current.filter((journal) => journal.id !== id));
    setExpandedId((current) => (current === id ? null : current));
  }
  const monthGroups = groupByMonth(items);

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
          <div className="journalMonthGroups">
            {monthGroups.map((group) => {
              const isOpen = Boolean(expandedMonths[group.month]);
              return (
                <section key={group.month} className="journalMonthGroup">
                  <button
                    type="button"
                    className="journalMonthHeader"
                    onClick={() =>
                      setExpandedMonths((current) => ({
                        ...current,
                        [group.month]: !current[group.month],
                      }))
                    }
                  >
                    <span className="sectionContextMonth">{group.month}</span>
                    <span className="journalMonthHeaderMeta">
                      {group.journals.length} {group.journals.length === 1 ? "entry" : "entries"} ·{" "}
                      {isOpen ? "expanded" : "collapsed"}
                    </span>
                  </button>
                  {isOpen ? (
                    <ul className="taskList reminderCompactList">
                      {group.journals.map((journal) => (
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
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
