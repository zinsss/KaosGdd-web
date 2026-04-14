"use client";

import { useEffect, useMemo, useState } from "react";
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

function TaskRow({
  task,
  mode,
  isExpanded,
  expandedSubtasks,
  subtasksLoading,
  subtaskLoadError,
  onTitleClick,
  onToggleResolved,
  onTaskNotFound,
  onActionError,
}) {
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
              onClick={(event) => onTitleClick(event, task)}
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

      {isExpanded ? (
        <div className="taskInlineSubtasks">
          {subtasksLoading ? (
            <div className="taskInlineSubtasksState">{UI_STRINGS.LOADING}</div>
          ) : subtaskLoadError ? (
            <div className="taskInlineSubtasksState errorText">{subtaskLoadError}</div>
          ) : expandedSubtasks.length === 0 ? (
            <div className="taskInlineSubtasksState">{UI_STRINGS.NONE}</div>
          ) : (
            <ul className="subtaskList">
              {expandedSubtasks.map((subtask) => (
                <li key={subtask.id} className="subtaskRow">
                  <span className={"taskListStateIcon" + (subtask.is_done ? " isDone" : " isUndone")}>
                    {subtask.is_done ? "✓" : "○"}
                  </span>
                  <div className={"subtaskText" + (subtask.is_done ? " taskLinkDone taskLinkDoneDetail" : "")}>
                    {subtask.content}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

export default function TasksPageClient({ initialMode }) {
  const mode = TASK_MODES.includes(initialMode) ? initialMode : "active";

  const [items, setItems] = useState([]);
  const [localError, setLocalError] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const [subtasksByTaskId, setSubtasksByTaskId] = useState({});
  const [loadingSubtasksTaskId, setLoadingSubtasksTaskId] = useState("");
  const [subtaskLoadErrors, setSubtaskLoadErrors] = useState({});

  useEffect(() => {
    const suffix = mode === "active" ? "" : `?mode=${encodeURIComponent(mode)}`;
    setLocalError("");

    fetch(`/api/tasks${suffix}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load tasks.");
        }
        setItems(data.items || []);
        setExpandedTaskId("");
        setLoadingSubtasksTaskId("");
        setSubtaskLoadErrors({});
      })
      .catch((err) => {
        setItems([]);
        setLocalError(err?.message || "Failed to load tasks.");
        setExpandedTaskId("");
        setLoadingSubtasksTaskId("");
        setSubtaskLoadErrors({});
      });
  }, [mode]);

  function removeRow(taskId) {
    setItems((current) => current.filter((task) => task.id !== taskId));
    setSubtasksByTaskId((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setSubtaskLoadErrors((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    if (expandedTaskId === taskId) {
      setExpandedTaskId("");
    }
    if (loadingSubtasksTaskId === taskId) {
      setLoadingSubtasksTaskId("");
    }
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

  async function ensureTaskSubtasksLoaded(taskId) {
    if (subtasksByTaskId[taskId]) return true;

    setLoadingSubtasksTaskId(taskId);
    setSubtaskLoadErrors((current) => ({ ...current, [taskId]: "" }));

    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load subtasks.");
      }
      const subtasks = Array.isArray(data?.item?.subtasks) ? data.item.subtasks : [];
      setSubtasksByTaskId((current) => ({ ...current, [taskId]: subtasks }));
      return true;
    } catch (err) {
      setSubtaskLoadErrors((current) => ({
        ...current,
        [taskId]: err?.message || "Failed to load subtasks.",
      }));
      return false;
    } finally {
      setLoadingSubtasksTaskId("");
    }
  }

  async function handleTaskTitleClick(event, task) {
    if (mode !== "active") return;

    const hasSubtasks = Number(task.subtask_total || 0) > 0;
    if (!hasSubtasks) return;

    if (expandedTaskId === task.id) {
      return;
    }

    event.preventDefault();
    const loaded = await ensureTaskSubtasksLoaded(task.id);
    if (!loaded) return;
    setExpandedTaskId(task.id);
  }

  const modeContext =
    mode === "done" ? "Done" : mode === "removed" ? "Removed" : mode === "archived" ? "Archived" : "Active";

  const modeContextClass =
    mode === "done"
      ? "sectionContextDone"
      : mode === "removed"
      ? "sectionContextRemoved"
      : mode === "archived"
      ? "sectionContextArchived"
      : "sectionContextActive";

  const doneGroups = useMemo(
    () => (mode === "done" ? groupDoneTasksByMonth(items || []) : []),
    [items, mode],
  );

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">
            <span className="sectionModuleName">{UI_STRINGS.TASKS}</span>
            <span className="sectionSeparator"> • </span>
            <span className={modeContextClass}>{modeContext}</span>
          </div>
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
                      isExpanded={expandedTaskId === task.id}
                      expandedSubtasks={subtasksByTaskId[task.id] || []}
                      subtasksLoading={loadingSubtasksTaskId === task.id}
                      subtaskLoadError={subtaskLoadErrors[task.id] || ""}
                      onTitleClick={handleTaskTitleClick}
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
                isExpanded={expandedTaskId === task.id}
                expandedSubtasks={subtasksByTaskId[task.id] || []}
                subtasksLoading={loadingSubtasksTaskId === task.id}
                subtaskLoadError={subtaskLoadErrors[task.id] || ""}
                onTitleClick={handleTaskTitleClick}
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
