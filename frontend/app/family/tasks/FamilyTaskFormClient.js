"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../FamilyHeader";
import {
  FAMILY_TASK_ASSIGNEES,
  createFamilyTaskId,
  loadFamilyTasks,
  normalizeFamilyTask,
  saveFamilyTasks,
} from "../familyTasks";

const EMPTY_DRAFT = {
  title: "",
  description: "",
  assignee: "",
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
      setError("하그라를 찾을 수 없어요.");
      return;
    }

    setDraft({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      due_date: task.due_date,
    });
  }, [taskId]);

  const pageTitle = useMemo(() => (isEditing ? "고치까" : "하그라"), [isEditing]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
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
                <option value="">선택 안 함</option>
                {FAMILY_TASK_ASSIGNEES.map((assignee) => (
                  <option value={assignee} key={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>날짜</span>
              <input type="date" value={draft.due_date} onChange={(event) => updateDraft("due_date", event.target.value)} />
            </label>
          </div>

          <div className="familyTaskFormActions">
            <button className="familyTaskSave" type="submit">
              되따
            </button>
            <Link className="familyTaskCancel" href="/family">
              고마하자
            </Link>
            {isEditing ? (
              <button className="familyTaskDelete" type="button" onClick={deleteTask}>
                치아라
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
