"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddReminderForm from "./AddReminderForm";
import ReminderActions from "./ReminderActions";
import TaskRawEditor from "./TaskRawEditor";
import TaskToggleButton from "./TaskToggleButton";
import SubtaskToggleButton from "./SubtaskToggleButton";
import LinkedItemsBlock from "./LinkedItemsBlock";
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
    case "completed":
      return 7;
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
      reminder.state === "cancelled" ||
      reminder.state === "completed",
    dimState: reminder.state === "acked" || reminder.state === "snoozed",
    dimmerState: reminder.state === "cancelled" || reminder.state === "completed",
  };
}

export default function TaskDetailPanel({ item, raw }) {
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState(null);
  const [copied, setCopied] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

  const sortedReminders = useMemo(() => {
    return [...(item.reminders || [])].sort((a, b) => {
      const priorityDiff = reminderPriority(a.state) - reminderPriority(b.state);
      if (priorityDiff !== 0) return priorityDiff;

      const whenA = a.remind_at || "";
      const whenB = b.remind_at || "";
      if (whenA !== whenB) return whenA.localeCompare(whenB);

      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }, [item.reminders]);
  const isRemoved = item.status === "removed";

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

  async function onRemoveTask() {
    const ok = window.confirm("Move this task to Removed?");
    if (!ok || isRemoving) return;

    setIsRemoving(true);
    setRemoveError("");

    try {
      const res = await fetch(`/api/tasks/${item.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setRemoveError((data && data.error) || "Task remove failed.");
        return;
      }

      router.push("/tasks?mode=removed");
      router.refresh();
    } catch {
      setRemoveError("Task remove failed.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <main className="page">
      <div className="detailBackLinkRow">
        <Link className="taskLink backLink" href="/tasks">
          {UI_STRINGS.BACK_TO_TASKS_LIST}
        </Link>
      </div>

      <section className="panel">
        <div className="detailPageLabel">• {UI_STRINGS.TASK_DETAIL}</div>

        <div className="detailTitleRow">
          <div
            className={
              "sectionTitle detailMainTitle" +
              (item.is_done ? " taskLinkDone taskLinkDoneDetail" : "")
            }
          >
            {item.title}
          </div>
          <div className="detailStateBox">
            <div className="detailStateText">
              {isRemoved ? UI_STRINGS.REMOVED_STATE : item.is_done ? UI_STRINGS.DONE_STATE : UI_STRINGS.ACTIVE}
            </div>
          </div>
        </div>

        <div className="detailReadBlock">
          {item.tags && item.tags.length > 0 ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Tags</div>
              <div className="detailReadContent withDivider">{item.tags.map((tag) => `#${tag}`).join(" ")}</div>
            </div>
          ) : null}

          {item.due_at_display ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Due</div>
              <div className="detailReadContent withDivider">
                <div className="detailReadInline">{item.due_at_display}</div>
              </div>
            </div>
          ) : null}

          {item.repeat_rule ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Repeat</div>
              <div className="detailReadContent withDivider">
                <div className="detailReadInline">{item.repeat_rule}</div>
              </div>
            </div>
          ) : null}

          {item.subtasks && item.subtasks.length > 0 ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Subtasks</div>
              <div className="detailReadContent detailReadList withDivider">
                {item.subtasks.map((subtask) => (
                  <div key={subtask.id} className="detailReadSubtaskRow">
                    {!isRemoved ? (
                      <SubtaskToggleButton taskId={item.id} subtaskId={subtask.id} isDone={Boolean(subtask.is_done)} />
                    ) : (
                      <span className={"taskListStateIcon" + (subtask.is_done ? " isDone" : " isUndone")}>
                        {subtask.is_done ? "✓" : "○"}
                      </span>
                    )}
                    <div className={"detailReadSubtaskText" + (subtask.is_done ? " taskLinkDone taskLinkDoneDetail" : "")}>
                      {subtask.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {item.memo ? (
            <div className="detailReadRow">
              <div className="detailReadLabel">Memo</div>
              <div className="detailReadContent detailReadMemo withDivider">
                {String(item.memo)
                  .split("\n")
                  .map((line, idx) => (
                    <div key={idx}>{line || "\u00A0"}</div>
                  ))}
              </div>
            </div>
          ) : null}

          <LinkedItemsBlock links={item.links} />

        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle">Reminders</div>

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

                  {!isRemoved && (reminder.state === "fired" || reminder.state === "missed") ? (
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
        {!isRemoved ? (
          <div className="actionRow detailActionRow">
            <TaskToggleButton taskId={item.id} isDone={item.is_done} />

            <button
              type="button"
              className={"button" + (openPanel === "reminder" ? " buttonActive" : "")}
              onClick={() => togglePanel("reminder")}
            >
              {UI_STRINGS.REMINDER_BUTTON}
            </button>

            <button
              type="button"
              className={"button" + (openPanel === "edit" ? " buttonActive" : "")}
              onClick={() => togglePanel("edit")}
            >
              {UI_STRINGS.EDIT_BUTTON}
            </button>

            <button
              type="button"
              className={"button" + (openPanel === "more" ? " buttonActive" : "")}
              onClick={() => togglePanel("more")}
            >
              {UI_STRINGS.MORE_BUTTON}
            </button>
          </div>
        ) : (
          <div className="empty">{UI_STRINGS.REMOVED_TASK_READONLY}</div>
        )}

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

        {openPanel === "more" ? (
          <div className="toggleBody moreMetaBox">
            <div className="metaStack">
              {item.created_at_display ? <div>{UI_STRINGS.CREATED}: {item.created_at_display}</div> : null}
              {item.updated_at_display ? <div>{UI_STRINGS.UPDATED}: {item.updated_at_display}</div> : null}

            </div>

            <div className="moreActionRow">
              <button type="button" className="button" onClick={onCopyId}>
                {copied ? UI_STRINGS.COPIED : UI_STRINGS.COPY_ID}
              </button>
              <button
                type="button"
                className="button"
                onClick={onRemoveTask}
                disabled={isRemoving}
              >
                {isRemoving ? "..." : UI_STRINGS.REMOVE_BUTTON}
              </button>
            </div>

            {removeError ? <div className="errorText">{removeError}</div> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
