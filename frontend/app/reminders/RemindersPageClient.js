"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ReminderRestoreButton from "../../components/ReminderRestoreButton";
import { UI_STRINGS } from "../../lib/strings";

const REMINDER_MODES = ["active", "fired", "removed"];

function buildReminderModeHref(mode) {
  return mode === "active" ? "/reminders" : `/reminders?mode=${mode}`;
}

function itemLetter(reminder) {
  if (!reminder.parent_item_type) return "R";

  const map = {
    task: "T",
    reminder: "R",
    event: "E",
    journal: "J",
    note: "N",
    file: "F",
    fax: "X",
    list: "L",
  };

  return map[reminder.parent_item_type] || "?";
}

function reminderWhen(reminder) {
  return reminder.snoozed_until_display || reminder.remind_at_display || "-";
}

function buildStandaloneReminderRaw(reminder) {
  const when = reminder.remind_at_display || reminderWhen(reminder);
  const tags = (reminder.tags || []).map((tag) => `#${tag}`).join(" ");
  const firstLineParts = [`!! ${when}`];
  if (reminder.title) firstLineParts.push(reminder.title);
  if (tags) firstLineParts.push(tags);
  return firstLineParts.join(" ").trim();
}

function parentHref(reminder) {
  if (!reminder.parent_item_id) return null;
  const type = reminder.parent_item_type || "task";
  const map = {
    task: `/tasks/${reminder.parent_item_id}`,
    event: `/events/${reminder.parent_item_id}`,
    journal: `/journals/${reminder.parent_item_id}`,
    note: `/notes/${reminder.parent_item_id}`,
    file: `/files/${reminder.parent_item_id}`,
    reminder: `/reminders/${reminder.parent_item_id}`,
  };
  return map[type] || `/tasks/${reminder.parent_item_id}`;
}

async function postReminderAction(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error((data && data.error) || "Reminder action failed.");
  }
}

function ReminderRow({ reminder, expanded, onToggle, mode }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const tags = (reminder.tags || []).map((tag) => `#${tag}`).join(" ");
  const letter = itemLetter(reminder);
  const titleText = reminder.parent_item_title || reminder.title;
  const isStandalone = !reminder.parent_item_id;
  const hasParent = Boolean(reminder.parent_item_id);
  const parentLink = parentHref(reminder);
  const requiresCompleteConfirm =
    reminder.state === "scheduled" || reminder.state === "snoozed" || reminder.state === "missed";
  const isActionableState =
    reminder.state === "scheduled" ||
    reminder.state === "fired" ||
    reminder.state === "missed" ||
    reminder.state === "snoozed";
  const isDoneState = reminder.state === "acked" || reminder.state === "completed";
  const rowStateClass = isDoneState
    ? " reminderRowDone"
    : reminder.state === "snoozed"
      ? " reminderRowSnoozed"
      : reminder.state === "missed"
        ? " reminderRowMissed"
        : "";

  async function runAction(fn) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLocalError("");

    try {
      await fn();
      window.location.reload();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Reminder action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit() {
    const raw = buildStandaloneReminderRaw(reminder);
    window.dispatchEvent(
      new CustomEvent("kaosgdd:start-reminder-edit", {
        detail: { id: reminder.id, raw },
      }),
    );
  }

  function addAsNew() {
    const raw = buildStandaloneReminderRaw(reminder);
    window.dispatchEvent(new CustomEvent("kaosgdd:add-reminder-as-new", { detail: { raw } }));
  }

  function onComplete() {
    if (requiresCompleteConfirm) {
      const confirmed = window.confirm(
        "This reminder has not fired yet. Completing it now will prevent it from firing and move it to Fired / Completed.",
      );
      if (!confirmed) return;
    }

    runAction(() => postReminderAction(`/api/reminders/${reminder.id}/complete`));
  }

  return (
    <li className={`taskListRow reminderListRow${rowStateClass}`} data-reminder-id={reminder.id}>
      <button type="button" className="reminderRowButton" onClick={onToggle}>
        <div className="reminderListTopLine">
          <span className="reminderListWhen">{reminderWhen(reminder)}</span>
          <span className="reminderListTags">{tags}</span>
        </div>

        <div className="reminderListTitleLine">
          <span className="reminderListType">[{letter}]</span>
          <span className="reminderListTitleText">{titleText}</span>
        </div>
      </button>

      {expanded ? (
        <div className="reminderExpandArea">
          {mode === "removed" ? (
            <div className="actionRow reminderExpandActions">
              <ReminderRestoreButton reminderId={reminder.id} />
            </div>
          ) : (
            <>
              <div className="actionRow reminderExpandActions">
                {isActionableState ? (
                  <>
                    <button
                      type="button"
                      className="button compactButton"
                      disabled={isSubmitting}
                      onClick={() =>
                        runAction(() => postReminderAction(`/api/reminders/${reminder.id}/ack`))
                      }
                    >
                      Ack
                    </button>

                    <button
                      type="button"
                      className="button compactButton"
                      disabled={isSubmitting}
                      onClick={() =>
                        runAction(() =>
                          postReminderAction(`/api/reminders/${reminder.id}/snooze`, { minutes: 10 })
                        )
                      }
                    >
                      Snooze
                    </button>

                    <button
                      type="button"
                      className="button compactButton"
                      disabled={isSubmitting}
                      onClick={onComplete}
                    >
                      {UI_STRINGS.COMPLETE}
                    </button>
                  </>
                ) : null}

                {isDoneState ? (
                  <button type="button" className="button compactButton" disabled={isSubmitting} onClick={addAsNew}>
                    Add as New
                  </button>
                ) : null}

                {!isActionableState && !isDoneState && isStandalone && reminder.state !== "removed" ? (
                  <button type="button" className="button compactButton" disabled={isSubmitting} onClick={startEdit}>
                    Edit
                  </button>
                ) : null}
              </div>

              {hasParent && parentLink ? (
                <div className="actionRow reminderExpandActions reminderExpandActionsSecondary">
                  <Link className="button compactButton reminderParentButton" href={parentLink}>
                    Go to Parent
                  </Link>
                </div>
              ) : null}
            </>
          )}

          {localError ? <div className="errorText">{localError}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

export default function RemindersPageClient({ initialMode, items, initialExpandedReminderId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = useState(initialExpandedReminderId || null);
  const listRef = useRef(null);
  const pendingInitialScrollIdRef = useRef(initialExpandedReminderId || null);
  const mode = REMINDER_MODES.includes(initialMode) ? initialMode : "active";

  const modeLinks = useMemo(
    () =>
      REMINDER_MODES.map((dotMode) => ({
        mode: dotMode,
        href: buildReminderModeHref(dotMode),
      })),
    [],
  );

  function setMode(nextMode) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextMode === "active") {
      params.delete("mode");
    } else {
      params.set("mode", nextMode);
    }
    params.delete("reminder_id");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    const targetId = pendingInitialScrollIdRef.current;
    if (!targetId || expandedId !== targetId) return;
    const root = listRef.current;
    if (!root) return;
    const row = root.querySelector(`[data-reminder-id="${CSS.escape(targetId)}"]`);
    if (!row) return;
    pendingInitialScrollIdRef.current = null;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expandedId, items]);

  function onTouchStart(event) {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    event.currentTarget.dataset.touchX = String(touch.clientX);
  }

  function onTouchEnd(event) {
    const startX = Number(event.currentTarget.dataset.touchX || "0");
    const touch = event.changedTouches?.[0];
    if (!touch || !startX) return;

    const deltaX = touch.clientX - startX;
    if (Math.abs(deltaX) < 50) return;

    const index = REMINDER_MODES.indexOf(mode);
    if (deltaX < 0 && index < REMINDER_MODES.length - 1) {
      setMode(REMINDER_MODES[index + 1]);
    } else if (deltaX > 0 && index > 0) {
      setMode(REMINDER_MODES[index - 1]);
    }
  }

  const modeContext = mode === "fired" ? "Fired / Completed" : mode === "removed" ? "Removed" : "Active";

  return (
    <main className="page">
      <section className="panel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">
            <span className="sectionModuleName">{UI_STRINGS.REMINDERS}</span>
            <span className="sectionSeparator"> • </span>
            <span
              className={
                mode === "fired"
                  ? "sectionContextFired"
                  : mode === "removed"
                  ? "sectionContextRemoved"
                  : "sectionContextActive"
              }
            >
              {modeContext}
            </span>
          </div>
          <div className="modeDots" aria-label="Reminder list mode">
            {modeLinks.map((entry) => (
              <Link
                key={entry.mode}
                href={entry.href}
                className={"modeDot" + (mode === entry.mode ? " modeDotActive" : "")}
                aria-label={`Show ${entry.mode} reminders`}
              />
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_REMINDERS}</div>
        ) : (
          <ul ref={listRef} className="taskList reminderCompactList">
            {items.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                expanded={expandedId === reminder.id}
                onToggle={() => setExpandedId(expandedId === reminder.id ? null : reminder.id)}
                mode={mode}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
