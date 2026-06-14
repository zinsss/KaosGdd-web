export const FAMILY_TASKS_STORAGE_KEY = "kaosgdd.family.tasks.v1";
export const FAMILY_TASK_ASSIGNEES = ["내가 하께", "니가 해라", "아무나 하자"];
export const FAMILY_TASK_DEFAULT_ASSIGNEE = "내가 하께";
export const FAMILY_TASK_PRIORITY_ASSIGNEE = "니가 해라";
export const FAMILY_TASK_PRIORITIES = ["😐 알아서 하그라", "😡 앵간하면 빨리해라이", "🤬 안하면 안될낀데?"];
export const FAMILY_TASK_DEFAULT_PRIORITY = "😐 알아서 하그라";

export function createFamilyTaskId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeFamilyTask(task) {
  if (!task || typeof task !== "object") return null;
  const title = String(task.title || "").trim();
  if (!title) return null;

  const now = new Date().toISOString();
  const assignee = FAMILY_TASK_ASSIGNEES.includes(task.assignee) ? task.assignee : FAMILY_TASK_DEFAULT_ASSIGNEE;
  const priority =
    assignee === FAMILY_TASK_PRIORITY_ASSIGNEE && FAMILY_TASK_PRIORITIES.includes(task.priority)
      ? task.priority
      : assignee === FAMILY_TASK_PRIORITY_ASSIGNEE
        ? FAMILY_TASK_DEFAULT_PRIORITY
        : "";

  return {
    id: String(task.id || createFamilyTaskId()),
    title,
    description: String(task.description || ""),
    assignee,
    priority,
    due_date: String(task.due_date || ""),
    done: Boolean(task.done),
    created_at: String(task.created_at || now),
    updated_at: String(task.updated_at || task.created_at || now),
    completed_at: task.done ? String(task.completed_at || task.updated_at || now) : "",
  };
}

export function sortActiveFamilyTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function sortDoneFamilyTasks(tasks) {
  return [...tasks].sort((a, b) =>
    String(b.completed_at || b.updated_at || b.created_at).localeCompare(String(a.completed_at || a.updated_at || a.created_at)),
  );
}

export function loadFamilyTasks() {
  try {
    const raw = window.localStorage.getItem(FAMILY_TASKS_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeFamilyTask).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveFamilyTasks(tasks) {
  try {
    window.localStorage.setItem(FAMILY_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    return;
  }
}

export function formatFamilyDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatFamilyDateTime(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
