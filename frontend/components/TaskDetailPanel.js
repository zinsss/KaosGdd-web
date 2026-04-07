"use client";

import { useMemo, useState } from "react";
import AddReminderForm from "./AddReminderForm";
import ReminderActions from "./ReminderActions";
import TaskRawEditor from "./TaskRawEditor";
import TaskToggleButton from "./TaskToggleButton";
import { UI_STRINGS } from "../lib/strings";

function reminderPriority(state) {
  switch (state) {
    case "fired":
      return 1;
    case "missed":
      return 2;
    case "scheduled":
      return 3;
    case "snoozed":
      return 4;
    case "acked":
      return 5;
    case "cancelled":
      return 6;
    default:
      return 9;
  }
}

function reminderFlags(reminder) {
  return {
    missed: reminder.state === "missed",
    strikeDateOnly:
      reminder.state === "fired" ||
      reminder.state === "acked" ||
      reminder.state === "snoozed" ||
      reminder.state === "cancelled",
    dimState: reminder.state === "acked" || reminder.state === "snoozed",
    dimmerState: reminder.state === "cancelled",
  };
}

function activeReminderDisplay(reminder) {
  if (reminder.state === "snoozed" && reminder.snoozed_until_display) {
    return reminder.snoozed_until_display;
  }
  return reminder.remind_at_display || "-";
}

export default function TaskDetailPanel({ item, raw }) {
  const [openPanel, setOpenPanel] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);

  const sortedReminders = useMemo(() => {
    return [...(item.reminders || [])].sort(
      (a, b) => reminderPriority(a.state) - reminderPriority(b.state)
    );
  }, [item.reminders]);

  const activeSummaryReminders = useMemo(() => {
    return sortedReminders.filter(
      (reminder) => reminder.state === "scheduled" || reminder.state === "snoozed"
    );
  }, [sortedReminders]);

  async function onCopyId() {
    try {
      await navigator.clipboard.writeText(item.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function togglePanel(name) {
    setOpenPanel((current) => (current === name ? null : name));
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="backRow">
          <a className="taskLink backLink" href="/tasks">
            {UI_STRINGS.BACK_TO_TASKS_LIST}
          </a>
        </div>
      </section>

      <section className="panel">
        <div className="detailPageLabel">{UI_STRINGS.TASK_DETAIL}</div>

        <div className="detailTitleRow">
          <div className={"sectionTitle detailMainTitle" + (item.is_done ? " taskLinkDone taskLinkDoneDetail" : "")}>
            {item.title}
          </div>
          <div className="detailStateText">
            {item.is_done ? UI_STRINGS.DONE_STATE : UI_STRINGS.ACTIVE}
          </div>
        </div>

        {(item.tags && item.tags.length > 0) || item.repeat_rule ? (
          <div className="metaLine">
            {item.tags && item.tags.length > 0 ? (
              <span>{item.tags.map((tag) => `#${tag}`).join(" ")}</span>
            ) : null}
            {item.repeat_rule ? <span>{`↻ ${item.repeat_rule}`}</span> : null}
          </div>
        ) : null}

        <div className="metaStack">
          {item.due_at_display ? (
            <div className="readMetaLine">
              <span>📅 {item.due_at_display}</span>
              {item.repeat_rule ? <span>↻ {item.repeat_rule}</span> : null}
            </div>
          ) : null}

          {activeSummaryReminders.map((reminder) => (
            <div key={"summary-" + reminder.id}>⏰ {activeReminderDisplay(reminder)}</div>
          ))}

          {item.memo ? (
            <div className="memoBlock">
              <div>📝</div>
              <div className="memoBody">{item.memo}</div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.REMINDER_LIST}</div>

        {sortedReminders.length > 0 ? (
          <ul className="taskList reminderCompactList">
            {sortedReminders.map((reminder) => {
              const flags = reminderFlags(reminder);

              return (
                <li key={reminder.id} className="reminderCompactItem">
                  <div className={"reminderCompactRow" + (flags.missed ? " reminderStateMissed" : "")}>
                    <span className={"reminderWhen" + (flags.strikeDateOnly ? " reminderWhenStruck" : "")}>
                      {reminder.remind_at_display || "-"}
                    </span>

                    <span
                      className={
                        "reminderState" +
                        (flags.dimState ? " reminderStateDim" : "") +
                        (flags.dimmerState ? " reminderStateDimmer" : "")
                      }
                    >
                      {reminder.state}
                    </span>
                  </div>

                  {reminder.state === "snoozed" && reminder.snoozed_until_display ? (
                    <div className="reminderNextLine">{">> "}{reminder.snoozed_until_display}</div>
                  ) : null}

                  {(reminder.state === "fired" || reminder.state === "missed") ? (
                    <ReminderActions reminderId={reminder.id} state={reminder.state} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">{UI_STRINGS.NO_REMINDERS}</div>
        )}
      </section>

      <section className="panel">
        <div className="actionRow detailActionRow">
          <TaskToggleButton taskId={item.id} isDone={item.is_done} compact />

          <button
            type="button"
            className={"button compactButton" + (openPanel === "reminder" ? " buttonActive" : "")}
            onClick={() => togglePanel("reminder")}
          >
            {UI_STRINGS.ADD_REMINDER}
          </button>

          <button
            type="button"
            className={"button compactButton" + (openPanel === "edit" ? " buttonActive" : "")}
            onClick={() => togglePanel("edit")}
          >
            {UI_STRINGS.EDIT_TASK}
          </button>

          <button
            type="button"
            className={"button compactButton" + (showMore ? " buttonActive" : "")}
            onClick={() => setShowMore((v) => !v)}
          >
            {UI_STRINGS.MORE}
          </button>
        </div>

        {openPanel === "reminder" ? (
          <div className="toggleBody">
            <AddReminderForm taskId={item.id} />
          </div>
        ) : null}

        {openPanel === "edit" ? (
          <div className="toggleBody">
            <TaskRawEditor taskId={item.id} initialRaw={raw || ""} />
          </div>
        ) : null}

        {showMore ? (
          <div className="toggleBody moreMetaBox">
            <div className="metaStack">
              <div>{UI_STRINGS.CREATED}: {item.created_at_display || "-"}</div>
              <div>{UI_STRINGS.UPDATED}: {item.updated_at_display || "-"}</div>
              <div className="copyRow">
                <span>{UI_STRINGS.ID}: {item.id}</span>
                <button type="button" className="button compactButton" onClick={onCopyId}>
                  {copied ? UI_STRINGS.COPIED : UI_STRINGS.COPY_ID}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}