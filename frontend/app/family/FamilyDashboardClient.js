"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "./FamilyHeader";
import {
  FAMILY_TASK_DEFAULT_ASSIGNEE,
  FAMILY_TASK_DEFAULT_PRIORITY,
  FAMILY_TASK_PRIORITIES,
  FAMILY_TASK_PRIORITY_ASSIGNEE,
  formatFamilyDate,
  loadFamilyTasks,
  saveFamilyTasks,
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

function getPriorityEmoji(priority) {
  const normalizedPriority = FAMILY_TASK_PRIORITIES.includes(priority) ? priority : FAMILY_TASK_DEFAULT_PRIORITY;
  return normalizedPriority.split(" ")[0];
}

function getTaskCardBadges(task) {
  const assignee = task.assignee || FAMILY_TASK_DEFAULT_ASSIGNEE;

  if (assignee === FAMILY_TASK_PRIORITY_ASSIGNEE) {
    return [{ className: "familyTaskBadgePriority", label: getPriorityEmoji(task.priority), title: task.priority || FAMILY_TASK_DEFAULT_PRIORITY }];
  }

  if (assignee === "전체") {
    return [{ className: "familyTaskBadgeAny", label: "👫", title: assignee }];
  }

  return [{ className: "familyTaskBadgeSelf", label: "👸🏻", title: FAMILY_TASK_DEFAULT_ASSIGNEE }];
}

export default function FamilyDashboardClient() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);

  useEffect(() => {
    setTasks(loadFamilyTasks());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveFamilyTasks(tasks);
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

  return (
    <section className="familyPage" aria-label="가족">
      <div className="familyCard">
        <FamilyHeader active="home" />

        <main className="familyDashboard">
          <section className="familyTaskSection familyDashboardPanel familyCalendarDashboardCard" aria-label="달력">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>달력</h2>
                <p>일정과 로운이 시간표를 함께 봐요.</p>
              </div>
              <Link className="familyTaskActionButton familyTaskActionButtonPrimary" href="/family/calendar">
                달력
              </Link>
            </div>
          </section>

          <section className="familyTaskSection" aria-label="할 일">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>할 일</h2>
                <p>{activeTasks.length}개 남음</p>
              </div>
              <div className="familyTaskHeaderActions">
                <Link className="familyTaskActionButton familyTaskActionButtonPrimary" href="/family/tasks/new">
                  + 할 일
                </Link>
                <Link className="familyTaskActionButton" href="/family/tasks/done">
                  완료
                </Link>
              </div>
            </div>

            <div className="familyTaskList">
              {activeTasks.length ? (
                activeTasks.map((task) => {
                  const taskBadges = getTaskCardBadges(task);

                  return (
                    <article
                      className={`familyTaskCard${task.id === draggingTaskId ? " familyTaskCardDragging" : ""}${task.id === dragOverTaskId ? " familyTaskCardDropTarget" : ""}`}
                      key={task.id}
                      onDragEnter={(event) => enterTaskDropTarget(event, task.id)}
                      onDragOver={(event) => enterTaskDropTarget(event, task.id)}
                      onDrop={(event) => dropTaskOnTarget(event, task.id)}
                    >
                      <button
                        className="familyTaskCheck"
                        type="button"
                        aria-label={`${task.title} 완료`}
                        onClick={() => completeTask(task.id)}
                      >
                        □
                      </button>
                      <div className="familyTaskCardBody">
                        <h3>{task.title}</h3>
                        <div className="familyTaskMeta">
                          {task.due_date ? <span className="familyTaskDateBadge">{formatFamilyDate(task.due_date)}</span> : null}
                          {taskBadges.map((badge) => (
                            <span className={`familyTaskBadge ${badge.className}`} title={badge.title} key={badge.className}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Link className="familyTaskEdit" href={`/family/tasks/${task.id}/edit`} aria-label={`${task.title} 수정`}>
                        ✎
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
