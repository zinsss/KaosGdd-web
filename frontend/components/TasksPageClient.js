"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TaskToggleButton from "./TaskToggleButton";
import TaskRestoreButton from "./TaskRestoreButton";
import { UI_STRINGS } from "../lib/strings";

const TASK_MODES = ["active", "done", "removed", "archived"];

function buildTaskModeHref(mode) {
  return mode === "active" ? "/tasks" : `/tasks?mode=${mode}`;
}

function getTaskMetaTag(task) {
  const parts = [];
  if (task.metatag_due) parts.push(task.metatag_due);
  if (task.repeat_rule) parts.push("↻");
  if (task.has_reminders) parts.push("R");
  if (task.has_tags) parts.push("#");
  return parts.join("");
}

function doneMonthKey(task) {
  const raw = String(task.done_at || "").trim();
  if (!raw) return UI_STRINGS.DONE_UNKNOWN_MONTH;
  return raw.slice(0, 7);
}

function groupDoneTasksByMonth(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = doneMonthKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function TaskRow({ task, mode, onToggleResolved, onTaskNotFound, onActionError }) {
  const metatag = getTaskMetaTag(task);
  const hasSubtasks = Number(task.subtask_total || 0) > 0;
  const showPrefixToggle = mode === "active";

  return (
    <li key={task.id} className="taskListRow">
      <div className="taskListRowMain">
        <div className="taskListTitleBlock">
          <div className="taskListTitleRow taskListTitleRowWithMeta">
            {showPrefixToggle ? (
              <TaskToggleButton
                taskId={task.id}
                isDone={task.is_done}
                prefixOnly
                onResolved={onToggleResolved}
                onNotFound={onTaskNotFound}
                onError={onActionError}
              />
            ) : (
              <span className={"taskListStateIcon" + (task.is_done ? " isDone" : " isUndone")}>
                {task.is_done ? "✓" : "○"}
              </span>
            )}

            <Link
              className={
                "taskLink taskListTitleLink" + (task.is_done ? " taskLinkDone taskLinkDoneList" : "")
              }
              href={"/tasks/" + task.id}
            >
              {task.title}
            </Link>

            {metatag ? <span className="taskListMetaTag">{metatag}</span> : null}
            {hasSubtasks ? (
              <span className="taskListSubtaskProgress">[{Number(task.subtask_done || 0)}/{Number(task.subtask_total || 0)}]</span>
            ) : null}
          </div>
        </div>

        {mode === "removed" ? (
          <div className="taskListAction">
            <TaskRestoreButton
              taskId={task.id}
              onResolved={onToggleResolved}
              onNotFound={onTaskNotFound}
              onError={onActionError}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function TasksPageClient({ initialMode, initialItems }) {
  const mode = TASK_MODES.includes(initialMode) ? initialMode : "active";
  const [items, setItems] = useState(initialItems || []);
  const [localError, setLocalError] = useState("");

  function removeRow(taskId) {
    setItems((current) => current.filter((task) => task.id !== taskId));
  }

  function handleTaskNotFound(taskId) {
    removeRow(taskId);
    setLocalError("");
  }

  function handleToggleResolved(taskId, response) {
    if (mode === "active" && (response?.item?.is_done || response?.is_done)) {
      removeRow(taskId);
      return;
    }

    if (mode === "done" && response?.item?.is_done === false) {
      removeRow(taskId);
      return;
    }

    if (mode === "removed") {
      removeRow(taskId);
    }
  }

  const modeTitle =
    mode === "done"
      ? UI_STRINGS.TASKS_DONE_TITLE
      : mode === "removed"
      ? UI_STRINGS.TASKS_REMOVED_TITLE
      : mode === "archived"
      ? UI_STRINGS.TASKS_ARCHIVED_TITLE
      : UI_STRINGS.TASKS_ACTIVE_TITLE;

  const doneGroups = useMemo(
    () => (mode === "done" ? groupDoneTasksByMonth(items || []) : []),
    [items, mode],
  );

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">{modeTitle}</div>
          <div className="modeDots" aria-label="Task list mode">
            {TASK_MODES.map((dotMode) => (
              <Link
                key={dotMode}
                href={buildTaskModeHref(dotMode)}
                className={"modeDot" + (mode === dotMode ? " modeDotActive" : "")}
                aria-label={`Show ${dotMode} tasks`}
              />
            ))}
          </div>
        </div>

        {localError ? <div className="errorText">{localError}</div> : null}

        {items.length === 0 ? (
          <div className="empty">{UI_STRINGS.NO_TASKS}</div>
        ) : mode === "done" ? (
          <div className="taskDoneGroups">
            {doneGroups.map(([month, monthTasks]) => (
              <details key={month} className="taskDoneMonthGroup">
                <summary className="taskDoneMonthHeader">{month} ({monthTasks.length})</summary>
                <ul className="taskList">
                  {monthTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      mode={mode}
                      onToggleResolved={handleToggleResolved}
                      onTaskNotFound={handleTaskNotFound}
                      onActionError={setLocalError}
                    />
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <ul className="taskList">
            {items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                mode={mode}
                onToggleResolved={handleToggleResolved}
                onTaskNotFound={handleTaskNotFound}
                onActionError={setLocalError}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
