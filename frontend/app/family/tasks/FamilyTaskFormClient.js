"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../FamilyHeader";
import {
  FAMILY_TASK_DEFAULT_ASSIGNEE,
  FAMILY_TASK_DEFAULT_PRIORITY,
  FAMILY_TASK_PRIORITIES,
  FAMILY_TASK_PRIORITY_ASSIGNEE,
  createFamilyTaskId,
  fetchFamilyTasks,
  normalizeFamilyTask,
  persistFamilyTasks,
} from "../familyTasks";

const EMPTY_DRAFT = {
  title: "",
  description: "",
  memo_checks: [],
  assignee: FAMILY_TASK_DEFAULT_ASSIGNEE,
  priority: FAMILY_TASK_DEFAULT_PRIORITY,
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
    let cancelled = false;
    fetchFamilyTasks().then((loadedTasks) => {
      if (cancelled) return;
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
        memo_checks: Array.isArray(task.memo_checks) ? task.memo_checks : [],
        assignee,
        priority: task.priority || FAMILY_TASK_DEFAULT_PRIORITY,
        due_date: task.due_date,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const pageTitle = useMemo(() => (isEditing ? "할 일 수정" : "할 일 추가"), [isEditing]);
  const sharedWithSong = draft.assignee === FAMILY_TASK_PRIORITY_ASSIGNEE;

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "title" && value.trim()) setError("");
  }

  function updateSongShared(checked) {
    setDraft((current) => ({
      ...current,
      assignee: checked ? FAMILY_TASK_PRIORITY_ASSIGNEE : FAMILY_TASK_DEFAULT_ASSIGNEE,
    }));
  }

  function goDashboard() {
    router.push("/family");
  }

  async function saveTask(event) {
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
      await persistFamilyTasks(nextTasks);
      goDashboard();
      return;
    }

    const nextTask = normalizeFamilyTask({
      id: createFamilyTaskId(),
      title,
      description: draft.description,
      memo_checks: draft.memo_checks,
      assignee: draft.assignee,
      priority: draft.priority,
      due_date: draft.due_date,
      done: false,
      created_at: now,
      updated_at: now,
    });

    await persistFamilyTasks([...tasks, nextTask].filter(Boolean));
    goDashboard();
  }

  async function deleteTask() {
    if (!isEditing || !loaded) return;
    await persistFamilyTasks(tasks.filter((task) => task.id !== taskId));
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

          <div className="familyTaskMemoField">
            <label htmlFor="familyTaskMemo">메모</label>
            <textarea
              id="familyTaskMemo"
              rows={4}
              value={draft.description}
              onChange={(event) => updateDraft("description", event.target.value)}
            />
            <p className="familyTaskMemoHint">- 로 시작하는 줄은 하위 할일로 보여요.</p>
          </div>

          <div className="familyTaskFormGrid">
            <div className="familyTaskPriorityShareRow">
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
              <button
                aria-pressed={sharedWithSong}
                className={`familyTaskSongToggle${sharedWithSong ? " familyTaskSongToggleActive" : ""}`}
                type="button"
                onClick={() => updateSongShared(!sharedWithSong)}
              >
                쏭
              </button>
            </div>

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
