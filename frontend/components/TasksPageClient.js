"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TaskToggleButton from "./TaskToggleButton";
import SubtaskToggleButton from "./SubtaskToggleButton";
import TaskRestoreButton from "./TaskRestoreButton";
import { UI_STRINGS } from "../lib/strings";
import { captureCreatedEventHasType } from "../lib/post-create-navigation";
import { localYmd, splitActiveTasksForRoutineBox } from "../lib/tasks/routine-grouping";

const TASK_MODES = ["active", "done", "removed", "archived"];

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("a, button, input, textarea, select, option"));
}

function buildTaskModeHref(mode) {
  return mode === "active" ? "/tasks" : `/tasks?mode=${mode}`;
}

function getTaskAuxMetaTag(task) {
  const parts = [];
  if (task.has_reminders) parts.push("R");
  if (task.has_tags) parts.push("#");
  return parts.join("");
}

function getTaskDueTone(task) {
  const metatagDue = String(task.metatag_due || "").trim();
  if (metatagDue.startsWith("+")) return "overdue";
  if (metatagDue === "t") return "today";
  return "";
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
  togglingSubtaskIds,
  onExpandTask,
  onSubtaskToggleStarted,
  onSubtaskToggleResolved,
  onSubtaskToggleNotFound,
  onToggleResolved,
  onTaskNotFound,
  onActionError,
}) {
  const auxMetatag = getTaskAuxMetaTag(task);
  const dueMetatag = String(task.metatag_due || "").trim();
  const hasSubtasks = Number(task.subtask_total || 0) > 0;
  const showPrefixToggle = mode === "active";
  const isRepeating = Boolean(task.repeat_rule);
  const dueTone = mode === "active" ? getTaskDueTone(task) : "";
  const titleTone =
    dueTone === "overdue"
      ? "overdue"
      : dueTone === "today"
      ? "today"
      : mode === "active" && isRepeating
      ? "repeating"
      : "";
  const titleToneClass =
    titleTone === "overdue"
      ? " taskListTitleOverdue"
      : titleTone === "today"
      ? " taskListTitleToday"
      : titleTone === "repeating"
      ? " taskListTitleRepeating"
      : "";

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
                "taskLink taskListTitleLink" + titleToneClass + (task.is_done ? " taskLinkDone taskLinkDoneList" : "")
              }
              href={"/tasks/" + task.id}
            >
              {task.title}
            </Link>

            {isRepeating ? <span className="taskListRepeatMarker">↻</span> : null}
            {dueMetatag || auxMetatag ? (
              <span className="taskListMetaTag">{dueMetatag}{auxMetatag}</span>
            ) : null}
            {hasSubtasks && mode === "active" ? (
              <button type="button" className="taskListSubtaskProgress" onClick={() => onExpandTask(task)}>
                {isExpanded ? "▼" : "▶"} [{Number(task.subtask_done || 0)}/{Number(task.subtask_total || 0)}]
              </button>
            ) : hasSubtasks ? (
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
        <div className={"taskInlineSubtasks" + (isRepeating ? " taskInlineSubtasksRepeating" : "")}>
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
                  <SubtaskToggleButton
                    taskId={task.id}
                    subtaskId={subtask.id}
                    isDone={Boolean(subtask.is_done)}
                    disabled={Boolean(togglingSubtaskIds[subtask.id])}
                    stopPropagation
                    refreshOnResolved={false}
                    onStarted={onSubtaskToggleStarted}
                    onResolved={onSubtaskToggleResolved}
                    onNotFound={onSubtaskToggleNotFound}
                    onError={onActionError}
                  />
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
  const router = useRouter();
  const mode = TASK_MODES.includes(initialMode) ? initialMode : "active";
  const touchStateRef = useRef({
    tracking: false,
    lock: "",
    switched: false,
    startX: 0,
    startY: 0,
  });

  const [items, setItems] = useState([]);
  const [localError, setLocalError] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const [subtasksByTaskId, setSubtasksByTaskId] = useState({});
  const [loadingSubtasksTaskId, setLoadingSubtasksTaskId] = useState("");
  const [subtaskLoadErrors, setSubtaskLoadErrors] = useState({});
  const [togglingSubtaskIds, setTogglingSubtaskIds] = useState({});

  function loadTasks() {
    const suffix = mode === "active" ? "" : `?mode=${encodeURIComponent(mode)}`;
    setLocalError("");

    fetch(`/api/tasks${suffix}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || UI_STRINGS.LOAD_TASKS_FAILED);
        }
        setItems(data.items || []);
        setExpandedTaskId("");
        setLoadingSubtasksTaskId("");
        setSubtaskLoadErrors({});
        setTogglingSubtaskIds({});
      })
      .catch((err) => {
        setItems([]);
        setLocalError(err?.message || UI_STRINGS.LOAD_TASKS_FAILED);
        setExpandedTaskId("");
        setLoadingSubtasksTaskId("");
        setSubtaskLoadErrors({});
        setTogglingSubtaskIds({});
      });
  }

  useEffect(() => {
    loadTasks();
  }, [mode]);

  useEffect(() => {
    function onCaptureCreated(event) {
      if (captureCreatedEventHasType(event, "task")) loadTasks();
    }

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
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
    setTogglingSubtaskIds((current) => {
      const next = { ...current };
      for (const subtask of subtasksByTaskId[taskId] || []) {
        delete next[subtask.id];
      }
      return next;
    });
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
        throw new Error(data?.error || UI_STRINGS.LOAD_SUBTASKS_FAILED);
      }
      const subtasks = Array.isArray(data?.item?.subtasks) ? data.item.subtasks : [];
      setSubtasksByTaskId((current) => ({ ...current, [taskId]: subtasks }));
      return true;
    } catch (err) {
      setSubtaskLoadErrors((current) => ({
        ...current,
        [taskId]: err?.message || UI_STRINGS.LOAD_SUBTASKS_FAILED,
      }));
      return false;
    } finally {
      setLoadingSubtasksTaskId("");
    }
  }


  function updateSubtaskState(taskId, subtaskId, isDone) {
    const previousSubtask = (subtasksByTaskId[taskId] || []).find((subtask) => subtask.id === subtaskId);
    const wasDone = Boolean(previousSubtask?.is_done);
    const doneDelta = isDone === wasDone ? 0 : isDone ? 1 : -1;

    setSubtasksByTaskId((current) => {
      const subtasks = current[taskId];
      if (!subtasks) return current;
      return {
        ...current,
        [taskId]: subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, is_done: isDone } : subtask,
        ),
      };
    });

    if (doneDelta === 0) return;

    setItems((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const total = Number(task.subtask_total || 0);
        const nextDone = Math.max(0, Math.min(total, Number(task.subtask_done || 0) + doneDelta));
        return { ...task, subtask_done: nextDone };
      }),
    );
  }

  function handleSubtaskToggleStarted(_taskId, subtaskId) {
    setTogglingSubtaskIds((current) => ({ ...current, [subtaskId]: true }));
  }

  function handleSubtaskToggleResolved(taskId, subtaskId, response) {
    updateSubtaskState(taskId, subtaskId, Boolean(response?.is_done));
    setTogglingSubtaskIds((current) => {
      const next = { ...current };
      delete next[subtaskId];
      return next;
    });
    setLocalError("");
  }

  function handleSubtaskToggleNotFound(taskId, subtaskId) {
    setTogglingSubtaskIds((current) => {
      const next = { ...current };
      delete next[subtaskId];
      return next;
    });
    setSubtasksByTaskId((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setSubtaskLoadErrors((current) => ({ ...current, [taskId]: UI_STRINGS.SUBTASK_NOT_FOUND }));
  }

  function handleSubtaskActionError(message, taskId, subtaskId) {
    setTogglingSubtaskIds((current) => {
      const next = { ...current };
      delete next[subtaskId];
      return next;
    });
    setLocalError(message);
  }

  async function handleTaskExpand(task) {
    if (mode !== "active") return;

    const hasSubtasks = Number(task.subtask_total || 0) > 0;
    if (!hasSubtasks) return;

    if (expandedTaskId === task.id) {
      return;
    }

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

  function switchModeByStep(step) {
    const currentIndex = TASK_MODES.indexOf(mode);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= TASK_MODES.length) return;
    router.push(buildTaskModeHref(TASK_MODES[nextIndex]));
  }

  function handleTouchStart(event) {
    if (isInteractiveTarget(event.target)) {
      clearTouchTracking();
      return;
    }
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStateRef.current = {
      tracking: true,
      lock: "",
      switched: false,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  }

  function handleTouchMove(event) {
    const state = touchStateRef.current;
    if (!state.tracking || state.switched || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!state.lock) {
      if (absX < 10 && absY < 10) return;
      if (absX > absY * 1.35 && absX > 16) {
        state.lock = "x";
      } else if (absY > absX) {
        state.lock = "y";
      } else {
        return;
      }
    }

    if (state.lock !== "x" || absX < 56) return;

    state.switched = true;
    state.tracking = false;
    switchModeByStep(deltaX < 0 ? 1 : -1);
  }

  const { routineTasks, normalTasks } = useMemo(
    () => splitActiveTasksForRoutineBox(items, localYmd(), mode),
    [items, mode],
  );

  function clearTouchTracking() {
    touchStateRef.current.tracking = false;
    touchStateRef.current.lock = "";
    touchStateRef.current.switched = false;
  }

  function renderTaskRows(tasks) {
    return tasks.map((task) => (
      <TaskRow
        key={task.id}
        task={task}
        mode={mode}
        isExpanded={expandedTaskId === task.id}
        expandedSubtasks={subtasksByTaskId[task.id] || []}
        subtasksLoading={loadingSubtasksTaskId === task.id}
        subtaskLoadError={subtaskLoadErrors[task.id] || ""}
        togglingSubtaskIds={togglingSubtaskIds}
        onExpandTask={handleTaskExpand}
        onSubtaskToggleStarted={handleSubtaskToggleStarted}
        onSubtaskToggleResolved={handleSubtaskToggleResolved}
        onSubtaskToggleNotFound={handleSubtaskToggleNotFound}
        onToggleResolved={handleToggleResolved}
        onTaskNotFound={handleTaskNotFound}
        onActionError={handleSubtaskActionError}
      />
    ));
  }

  return (
    <main
      className="page taskModeSwipeArea"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={clearTouchTracking}
      onTouchCancel={clearTouchTracking}
    >
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
                <ul className="taskList">{renderTaskRows(monthTasks)}</ul>
              </details>
            ))}
          </div>
        ) : mode === "active" ? (
          <div className="activeTaskSections">
            {routineTasks.length > 0 ? (
              <section className="taskRoutineBox" aria-label={UI_STRINGS.TASK_ROUTINES_TITLE}>
                <div className="taskListSubsectionTitle taskListSubsectionTitleRoutine">{UI_STRINGS.TASK_ROUTINES_TITLE}</div>
                <ul className="taskList">{renderTaskRows(routineTasks)}</ul>
              </section>
            ) : null}

            {normalTasks.length > 0 ? (
              <section className="taskNormalSection" aria-label={UI_STRINGS.TASK_ONE_OFF_TITLE}>
                <div className="taskListSubsectionTitle taskListSubsectionTitleTask">{UI_STRINGS.TASK_ONE_OFF_TITLE}</div>
                <ul className="taskList">{renderTaskRows(normalTasks)}</ul>
              </section>
            ) : null}
          </div>
        ) : (
          <ul className="taskList">{renderTaskRows(items)}</ul>
        )}
      </section>
    </main>
  );
}
