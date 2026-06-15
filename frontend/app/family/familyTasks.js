export const FAMILY_TASKS_STORAGE_KEY = "kaosgdd.family.tasks.v1";
export const FAMILY_TASK_ASSIGNEES = ["내 할 일", "쏭 할 일", "전체"];
export const FAMILY_TASK_DEFAULT_ASSIGNEE = "내 할 일";
export const FAMILY_TASK_PRIORITY_ASSIGNEE = "쏭 할 일";
export const FAMILY_TASK_PRIORITIES = ["😐 보통", "🙂 조금 빨리", "⭐ 중요"];
export const FAMILY_TASK_DEFAULT_PRIORITY = "😐 보통";

export function createFamilyTaskId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fallbackSortOrder(task) {
  const created = Date.parse(task?.created_at || "");
  if (Number.isFinite(created)) return created;

  return Date.now();
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
  const sortOrder = Number.isFinite(Number(task.sort_order)) ? Number(task.sort_order) : fallbackSortOrder(task);

  return {
    id: String(task.id || createFamilyTaskId()),
    title,
    description: String(task.description || ""),
    assignee,
    priority,
    due_date: String(task.due_date || ""),
    done: Boolean(task.done),
    sort_order: sortOrder,
    created_at: String(task.created_at || now),
    updated_at: String(task.updated_at || task.created_at || now),
    completed_at: task.done ? String(task.completed_at || task.updated_at || now) : "",
  };
}

export function sortActiveFamilyTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : fallbackSortOrder(a);
    const orderB = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : fallbackSortOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
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
