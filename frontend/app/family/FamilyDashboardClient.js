"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "./FamilyHeader";
import {
  FAMILY_TASK_DEFAULT_ASSIGNEE,
  FAMILY_TASK_DEFAULT_PRIORITY,
  FAMILY_TASK_PRIORITIES,
  FAMILY_TASK_PRIORITY_ASSIGNEE,
  fetchFamilyTasks,
  formatFamilyTaskDueDate,
  persistFamilyTasks,
  sortActiveFamilyTasks,
} from "./familyTasks";

function moveTaskId(taskIds, sourceId, targetId) {
  const sourceIndex = taskIds.indexOf(sourceId);
  const targetIndex = taskIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return taskIds;

  const nextIds = [...taskIds];
  const [movedId] = nextIds.splice(sourceIndex, 1);
  nextIds.splice(targetIndex, 0, movedId);
  return nextIds;
}

function getTaskCardBadges(task) {
  const assignee = task.assignee || FAMILY_TASK_DEFAULT_ASSIGNEE;
  const priority = FAMILY_TASK_PRIORITIES.includes(task.priority) ? task.priority : FAMILY_TASK_DEFAULT_PRIORITY;
  const priorityEmoji = String(priority).trim().split(/\s+/)[0] || priority;
  const badges = [{ className: "familyTaskPriorityEmoji", label: priorityEmoji, title: priority }];

  if (assignee === FAMILY_TASK_PRIORITY_ASSIGNEE) {
    badges.push({ className: "familyTaskSongText", label: "쏭", title: "쏭" });
  }

  return badges;
}

function getTaskMemoLines(task) {
  return String(task.description || "")
    .split("\n")
    .map((line) => line.trim());
}

function parseTaskMemo(task) {
  const subtaskLines = [];
  const memoLines = [];

  for (const line of getTaskMemoLines(task)) {
    if (!line) continue;
    if (line.startsWith("-")) {
      const text = line.replace(/^-+\s*/, "").trim();
      if (text) subtaskLines.push(text);
      continue;
    }
    memoLines.push(line);
  }

  return {
    subtaskLines,
    memoText: memoLines.join("\n"),
  };
}

export default function FamilyDashboardClient() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchFamilyTasks().then((loadedTasks) => {
      if (cancelled) return;
      setTasks(loadedTasks);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persistFamilyTasks(tasks);
  }, [loaded, tasks]);

  const activeTasks = useMemo(() => sortActiveFamilyTasks(tasks.filter((task) => !task.done)), [tasks]);

  function completeTask(taskId) {
    const now = new Date().toISOString();
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: true,
              completed_at: now,
              updated_at: now,
            }
          : task,
      ),
    );
    setExpandedTaskId((current) => (current === taskId ? "" : current));
  }

  function deleteTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setExpandedTaskId((current) => (current === taskId ? "" : current));
  }

  function toggleTaskSubtaskLine(taskId, lineIndex) {
    const now = new Date().toISOString();
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const memoChecks = Array.isArray(task.memo_checks) ? [...task.memo_checks] : [];
        memoChecks[lineIndex] = !memoChecks[lineIndex];
        return {
          ...task,
          memo_checks: memoChecks,
          updated_at: now,
        };
      }),
    );
  }

  function reorderActiveTasks(sourceTaskId, targetTaskId) {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;

    const now = new Date().toISOString();
    setTasks((current) => {
      const activeIds = sortActiveFamilyTasks(current.filter((task) => !task.done)).map((task) => task.id);
      const reorderedIds = moveTaskId(activeIds, sourceTaskId, targetTaskId);
      if (reorderedIds === activeIds) return current;

      const orderById = new Map(reorderedIds.map((taskId, index) => [taskId, index]));
      return current.map((task) => {
        if (!orderById.has(task.id)) return task;
        return {
          ...task,
          sort_order: orderById.get(task.id),
          updated_at: now,
        };
      });
    });
  }

  function startTaskDrag(event, taskId) {
    setDraggingTaskId(taskId);
    setDragOverTaskId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  function enterTaskDropTarget(event, taskId) {
    if (!draggingTaskId || draggingTaskId === taskId) return;
    event.preventDefault();
    setDragOverTaskId(taskId);
  }

  function dropTaskOnTarget(event, targetTaskId) {
    event.preventDefault();
    const sourceTaskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
    reorderActiveTasks(sourceTaskId, targetTaskId);
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  }

  function endTaskDrag() {
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  }

  function toggleTask(taskId) {
    setExpandedTaskId((current) => (current === taskId ? "" : taskId));
  }

  return (
    <section className="familyPage" aria-label="가족">
      <div className="familyCard">
        <FamilyHeader active="home" />

        <main className="familyDashboard">
          <section className="familyTaskSection" aria-label="할일">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>할일</h2>
                <p>{activeTasks.length}개 남음</p>
              </div>
              <div className="familyTaskHeaderActions">
                <Link className="familyTaskActionButton familyTaskActionButtonPrimary" href="/family/tasks/new">
                  + 할일
                </Link>
                <Link className="familyTaskActionButton" href="/family/tasks/done">
                  완료한 할일
                </Link>
              </div>
            </div>

            <div className="familyTaskList">
              {activeTasks.length ? (
                activeTasks.map((task) => {
                  const taskBadges = getTaskCardBadges(task);
                  const expanded = expandedTaskId === task.id;
                  const memoData = parseTaskMemo(task);
                  const sharedWithSong = task.assignee === FAMILY_TASK_PRIORITY_ASSIGNEE;

                  return (
                    <article
                      className={`familyTaskCard${expanded ? " familyTaskCardExpanded" : ""}${task.id === draggingTaskId ? " familyTaskCardDragging" : ""}${task.id === dragOverTaskId ? " familyTaskCardDropTarget" : ""}`}
                      key={task.id}
                      onDragEnter={(event) => enterTaskDropTarget(event, task.id)}
                      onDragOver={(event) => enterTaskDropTarget(event, task.id)}
                      onDrop={(event) => dropTaskOnTarget(event, task.id)}
                    >
                      <div className="familyTaskCardBody">
                        <button
                          className="familyTaskInlineCheck"
                          type="button"
                          aria-label={`${task.title} 완료`}
                          onClick={() => completeTask(task.id)}
                        />
                        <button
                          className="familyTaskRowToggle"
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => toggleTask(task.id)}
                        >
                          <h3>{task.title}</h3>
                          <div className="familyTaskMeta">
                            <span className="familyTaskMetaBadges">
                              {taskBadges.map((badge) => (
                                <span className={badge.className} title={badge.title} key={badge.className}>
                                  {badge.label}
                                </span>
                              ))}
                            </span>
                            {task.due_date ? <span className="familyTaskDateBadge">{formatFamilyTaskDueDate(task.due_date)}</span> : null}
                          </div>
                        </button>
                      </div>
                      {expanded ? (
                        <div className="familyTaskExpandedContent">
                          {memoData.subtaskLines.length ? (
                            <div className="familyTaskMemoChecklist" aria-label={`${task.title} 하위 할일`}>
                              {memoData.subtaskLines.map((line, lineIndex) => {
                                const checked = Boolean(task.memo_checks?.[lineIndex]);
                                return (
                                  <button
                                    className={`familyTaskMemoCheckItem${checked ? " familyTaskMemoCheckItemDone" : ""}`}
                                    type="button"
                                    onClick={() => toggleTaskSubtaskLine(task.id, lineIndex)}
                                    key={`${task.id}-${lineIndex}`}
                                  >
                                    <span className="familyTaskMemoCheckBox" aria-hidden="true">
                                      {checked ? "✓" : ""}
                                    </span>
                                    <span>{line}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}

                          {memoData.memoText ? <p className="familyTaskMemoText">{memoData.memoText}</p> : null}

                          <div className="familyTaskRowActions">
                            <button className="familyTaskActionButton familyTaskActionButtonDone" type="button" onClick={() => completeTask(task.id)}>
                              완 료
                            </button>
                            <button className="familyTaskActionButton familyTaskActionButtonDanger" type="button" onClick={() => deleteTask(task.id)}>
                              삭 제
                            </button>
                            <button
                              className={`familyTaskActionButton familyTaskActionButtonSong${sharedWithSong ? " familyTaskActionButtonSongActive" : ""}`}
                              type="button"
                              aria-pressed={sharedWithSong}
                              onClick={() => {
                                const now = new Date().toISOString();
                                setTasks((current) =>
                                  current.map((candidate) =>
                                    candidate.id === task.id
                                      ? {
                                          ...candidate,
                                          assignee: sharedWithSong ? FAMILY_TASK_DEFAULT_ASSIGNEE : FAMILY_TASK_PRIORITY_ASSIGNEE,
                                          updated_at: now,
                                        }
                                      : candidate,
                                  ),
                                );
                              }}
                            >
                              쏭
                            </button>
                            <Link className="familyTaskActionButton" href={`/family/tasks/${task.id}/edit`}>
                              수 정
                            </Link>
                            <button
                              className="familyTaskDragHandle"
                              type="button"
                              draggable
                              aria-label={`${task.title} 순서 옮기기`}
                              onDragStart={(event) => startTaskDrag(event, task.id)}
                              onDragEnd={endTaskDrag}
                            >
                              ☰
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="familyTaskEmpty">아직 할 일이 없어요.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
