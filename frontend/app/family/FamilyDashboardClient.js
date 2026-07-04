"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "./FamilyHeader";
import {
  FAMILY_TASK_DEFAULT_ASSIGNEE,
  FAMILY_TASK_DEFAULT_PRIORITY,
  FAMILY_TASK_PRIORITIES,
  FAMILY_TASK_PRIORITY_ASSIGNEE,
  formatFamilyTaskDueDate,
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

function getTaskCardBadges(task) {
  const assignee = task.assignee || FAMILY_TASK_DEFAULT_ASSIGNEE;
  const priority = FAMILY_TASK_PRIORITIES.includes(task.priority) ? task.priority : FAMILY_TASK_DEFAULT_PRIORITY;
  const badges = [{ className: "familyTaskPriorityEmoji", label: priority.split(" ")[0] || priority, title: priority.split(" ")[0] || priority }];

  if (assignee === FAMILY_TASK_PRIORITY_ASSIGNEE) {
    badges.push({ className: "familyTaskBadge familyTaskBadgeSong", label: "쏭", title: "쏭" });
  }

  return badges;
}

export default function FamilyDashboardClient() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState("");

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
    setExpandedTaskId((current) => (current === taskId ? "" : current));
  }

  function deleteTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setExpandedTaskId((current) => (current === taskId ? "" : current));
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

                  return (
                    <article
                      className={`familyTaskCard${expanded ? " familyTaskCardExpanded" : ""}${task.id === draggingTaskId ? " familyTaskCardDragging" : ""}${task.id === dragOverTaskId ? " familyTaskCardDropTarget" : ""}`}
                      key={task.id}
                      onDragEnter={(event) => enterTaskDropTarget(event, task.id)}
                      onDragOver={(event) => enterTaskDropTarget(event, task.id)}
                      onDrop={(event) => dropTaskOnTarget(event, task.id)}
                    >
                      <button
                        className="familyTaskRowToggle"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggleTask(task.id)}
                      >
                        <div className="familyTaskCardBody">
                          <h3><span aria-hidden="true">•</span>{task.title}</h3>
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
                        </div>
                      </button>
                      {expanded ? (
                        <div className="familyTaskRowActions">
                          <Link className="familyTaskActionButton" href={`/family/tasks/${task.id}/edit`}>
                            수정
                          </Link>
                          <button className="familyTaskActionButton familyTaskActionButtonDone" type="button" onClick={() => completeTask(task.id)}>
                            완료
                          </button>
                          <button className="familyTaskActionButton familyTaskActionButtonDanger" type="button" onClick={() => deleteTask(task.id)}>
                            삭제
                          </button>
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
