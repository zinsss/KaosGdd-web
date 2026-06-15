"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../FamilyHeader";
import {
  FAMILY_TASK_ASSIGNEES,
  FAMILY_TASK_DEFAULT_ASSIGNEE,
  FAMILY_TASK_DEFAULT_PRIORITY,
  FAMILY_TASK_PRIORITIES,
  FAMILY_TASK_PRIORITY_ASSIGNEE,
  createFamilyTaskId,
  loadFamilyTasks,
  normalizeFamilyTask,
  saveFamilyTasks,
} from "../familyTasks";

const EMPTY_DRAFT = {
  title: "",
  description: "",
  assignee: FAMILY_TASK_DEFAULT_ASSIGNEE,
  priority: "",
  due_date: "",
};

export default function FamilyTaskFormClient({ taskId = null }) {
  const router = useRouter();
  const isEditing = Boolean(taskId);
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadedTasks = loadFamilyTasks();
    setTasks(loadedTasks);
    setLoaded(true);

    if (!taskId) return;
    const task = loadedTasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      setError("할 일을 찾을 수 없어요.");
      return;
    }

    const assignee = task.assignee || FAMILY_TASK_DEFAULT_ASSIGNEE;
    setDraft({
      title: task.title,
      description: task.description,
      assignee,
      priority: assignee === FAMILY_TASK_PRIORITY_ASSIGNEE ? task.priority || FAMILY_TASK_DEFAULT_PRIORITY : "",
      due_date: task.due_date,
    });
  }, [taskId]);

  const pageTitle = useMemo(() => (isEditing ? "할 일 수정" : "할 일 추가"), [isEditing]);
  const showPriority = draft.assignee === FAMILY_TASK_PRIORITY_ASSIGNEE;

  function updateDraft(field, value) {
    setDraft((current) => {
      if (field === "assignee") {
        return {
          ...current,
          assignee: value,
          priority: value === FAMILY_TASK_PRIORITY_ASSIGNEE ? current.priority || FAMILY_TASK_DEFAULT_PRIORITY : "",
        };
      }

      return { ...current, [field]: value };
    });
    if (field === "title" && value.trim()) setError("");
  }

  function goDashboard() {
    router.push("/family");
  }

  function saveTask(event) {
    event.preventDefault();
    if (!loaded) return;

    const title = draft.title.trim();
    if (!title) {
      setError("제목을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();

    if (isEditing) {
      const nextTasks = tasks.map((task) =>
        task.id === taskId
          ? normalizeFamilyTask({
              ...task,
              ...draft,
              title,
              updated_at: now,
            })
          : task,
      ).filter(Boolean);
      saveFamilyTasks(nextTasks);
      goDashboard();
      return;
    }

    const nextTask = normalizeFamilyTask({
      id: createFamilyTaskId(),
      title,
      description: draft.description,
      assignee: draft.assignee,
      priority: draft.priority,
      due_date: draft.due_date,
      done: false,
      created_at: now,
      updated_at: now,
    });

    saveFamilyTasks([...tasks, nextTask].filter(Boolean));
    goDashboard();
  }

  function deleteTask() {
    if (!isEditing || !loaded) return;
    saveFamilyTasks(tasks.filter((task) => task.id !== taskId));
    goDashboard();
  }

  return (
    <section className="familyPage" aria-label={pageTitle}>
      <div className="familyCard familyTaskPageCard">
        <FamilyHeader active="home" />

        <form className="familyTaskForm" onSubmit={saveTask}>
          <h2 className="familyTaskPageTitle">{pageTitle}</h2>
          <label>
            <span>제목 *</span>
            <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
          </label>
          {error ? (
            <p className="familyTaskFormError" role="alert">
              {error}
            </p>
          ) : null}

          <label>
            <span>설명</span>
            <textarea rows={4} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
          </label>

          <div className="familyTaskFormGrid">
            <label>
              <span>담당자</span>
              <select value={draft.assignee} onChange={(event) => updateDraft("assignee", event.target.value)}>
                {FAMILY_TASK_ASSIGNEES.map((assignee) => (
                  <option value={assignee} key={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </label>

            {showPriority ? (
              <label className="familyTaskPriorityField">
                <span>중요도</span>
                <select value={draft.priority || FAMILY_TASK_DEFAULT_PRIORITY} onChange={(event) => updateDraft("priority", event.target.value)}>
                  {FAMILY_TASK_PRIORITIES.map((priority) => (
                    <option value={priority} key={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span>날짜</span>
              <input
                className="familyTaskDateInput"
                type="date"
                value={draft.due_date}
                onChange={(event) => updateDraft("due_date", event.target.value)}
              />
            </label>
          </div>

          <div className="familyTaskFormActions">
            <button className="familyTaskSave" type="submit">
              저장
            </button>
            <Link className="familyTaskCancel" href="/family">
              취소
            </Link>
            {isEditing ? (
              <button className="familyTaskDelete" type="button" onClick={deleteTask}>
                삭제
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
