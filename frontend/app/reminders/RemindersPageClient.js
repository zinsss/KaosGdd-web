"use client";

import { useMemo, useState } from "react";
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
  const when = reminderWhen(reminder);
  const tags = (reminder.tags || []).map((tag) => `#${tag}`).join(" ");
  return `!! ${when}${reminder.title ? ` ${reminder.title}` : ""}${tags ? ` ${tags}` : ""}`.trim();
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

  return (
    <li className="taskListRow reminderListRow">
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
          ) : isStandalone ? (
            <div className="actionRow reminderExpandActions">
              {(reminder.state === "fired" || reminder.state === "missed") ? (
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
                </>
              ) : null}

              {reminder.state !== "removed" &&
              reminder.state !== "acked" &&
              reminder.state !== "cancelled" ? (
                <button
                  type="button"
                  className="button compactButton"
                  disabled={isSubmitting}
                  onClick={startEdit}
                >
                  Edit
                </button>
              ) : null}

              <button
                type="button"
                className="button compactButton"
                disabled={isSubmitting}
                onClick={() =>
                  runAction(async () => {
                    const res = await fetch(`/api/reminders/${reminder.id}`, {
                      method: "DELETE",
                    });
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data?.ok) {
                      throw new Error((data && data.error) || "Reminder remove failed.");
                    }
                  })
                }
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="actionRow reminderExpandActions">
              <Link
                className="button compactButton reminderParentButton"
                href={`/tasks/${reminder.parent_item_id}`}
              >
                Go to Parent
              </Link>
            </div>
          )}

          {localError ? <div className="errorText">{localError}</div> : null}
        </div>
      ) : null}
    </li>
  );
}

export default function RemindersPageClient({ initialMode, items }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = useState(null);
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
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

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

  const modeContext = mode === "fired" ? "Fired" : mode === "removed" ? "Removed" : "Active";

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
          <ul className="taskList reminderCompactList">
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
