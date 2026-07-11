export const FAMILY_TASKS_STORAGE_KEY = "kaosgdd.family.tasks.v1";
export const FAMILY_TASK_ASSIGNEES = ["내 할 일", "쏭 할 일", "전체"];
export const FAMILY_TASK_DEFAULT_ASSIGNEE = "내 할 일";
export const FAMILY_TASK_PRIORITY_ASSIGNEE = "쏭 할 일";
export const FAMILY_TASK_PRIORITIES = ["💤 언젠가는", "😄 보통", "⭐️ 중요", "‼️ 꼭 하기"];
export const FAMILY_TASK_DEFAULT_PRIORITY = "😄 보통";
export const FAMILY_TASK_CANONICAL_UNCHECKED_SUBTASK_PREFIX = "--- ";
export const FAMILY_TASK_CANONICAL_CHECKED_SUBTASK_PREFIX = "--x ";
const FAMILY_TASK_PRIORITY_ALIASES = {
  ["💤 언젠가는" + "..."]: "💤 언젠가는",
  ["⭐️ 중요! " + "늦지않기"]: "⭐️ 중요",
  ["‼️ 꼭! " + "\uc8fd\uc5b4\ub3c4" + " 하기"]: "‼️ 꼭 하기",
  ["‼️ " + "\uc548\ud558\uba74 \uc8fd\ub294\ub2e4"]: "‼️ 꼭 하기",
  ["⭐️ " + "\uc65c\ub9cc\ud558\uba74 \ube68\ub9ac\ud574\ub77c"]: "⭐️ 중요",
  ["⭐️ " + "\uc575\uac04\ud558\uba74 \ube68\ub9ac\ud574\ub77c\uc774"]: "⭐️ 중요",
};

function trimBlankEdges(lines) {
  const next = [...lines];
  while (next.length && !String(next[0] || "").trim()) next.shift();
  while (next.length && !String(next[next.length - 1] || "").trim()) next.pop();
  return next;
}

export function extractFamilyTaskChecklist(description) {
  const subtasks = [];
  const memoFragments = [];
  let currentMemoLines = [];

  function flushMemoFragment() {
    const trimmed = trimBlankEdges(currentMemoLines);
    if (trimmed.length) memoFragments.push(trimmed.join("\n"));
    currentMemoLines = [];
  }

  for (const rawLine of String(description || "").split("\n")) {
    if (rawLine.startsWith("- ") || rawLine.startsWith("+ ")) {
      const content = rawLine.slice(2).trim();
      if (content) {
        flushMemoFragment();
        subtasks.push({
          content,
          is_done: rawLine.startsWith("+ "),
          position: subtasks.length,
        });
      }
      continue;
    }

    currentMemoLines.push(rawLine);
  }

  flushMemoFragment();

  return {
    memo: memoFragments.join("\n\n"),
    subtasks,
  };
}

export function buildFamilyTaskCanonicalRaw(task) {
  const normalized = normalizeFamilyTask(task);
  if (!normalized) return "";
  const checklist = extractFamilyTaskChecklist(normalized.description);
  const lines = [`-- ${normalized.title}`];

  for (const subtask of checklist.subtasks) {
    lines.push(
      `${subtask.is_done ? FAMILY_TASK_CANONICAL_CHECKED_SUBTASK_PREFIX : FAMILY_TASK_CANONICAL_UNCHECKED_SUBTASK_PREFIX}${subtask.content}`,
    );
  }

  if (checklist.memo) {
    lines.push('"""', checklist.memo, '"""');
  }

  return lines.join("\n");
}

export function applyLegacyFamilyTaskMemoChecks(description, memoChecks) {
  const checks = Array.isArray(memoChecks) ? memoChecks.map(Boolean) : [];
  if (!checks.some(Boolean)) return String(description || "");

  let checklistIndex = -1;
  return String(description || "")
    .split("\n")
    .map((line) => {
      if (!line.startsWith("- ") && !line.startsWith("+ ")) return line;
      const content = line.slice(2).trim();
      if (!content) return line;
      checklistIndex += 1;
      return `${checks[checklistIndex] ? "+ " : "- "}${line.slice(2)}`;
    })
    .join("\n");
}

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
  const priorityValue = FAMILY_TASK_PRIORITY_ALIASES[task.priority] || task.priority;
  const priority = FAMILY_TASK_PRIORITIES.includes(priorityValue) ? priorityValue : FAMILY_TASK_DEFAULT_PRIORITY;
  const sortOrder = Number.isFinite(Number(task.sort_order)) ? Number(task.sort_order) : fallbackSortOrder(task);
  const memoChecks = Array.isArray(task.memo_checks)
    ? task.memo_checks.map(Boolean)
    : Array.isArray(task.description_checks)
      ? task.description_checks.map(Boolean)
      : [];
  const description = applyLegacyFamilyTaskMemoChecks(task.description, memoChecks);

  return {
    id: String(task.id || createFamilyTaskId()),
    title,
    description,
    memo_checklist: Boolean(task.memo_checklist || task.description_checklist),
    memo_checks: memoChecks,
    assignee,
    priority,
    due_date: String(task.due_date || ""),
    done: Boolean(task.done),
    mainItemId: String(task.mainItemId || ""),
    adoptedFromMain: task.adoptedFromMain === true,
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

export async function fetchFamilyTasks() {
  try {
    const response = await fetch("/api/family/tasks", { cache: "no-store" });
    if (!response.ok) throw new Error("family task fetch failed");
    const parsed = await response.json();
    const taskPayload = Array.isArray(parsed) ? parsed : parsed?.tasks;
    if (!Array.isArray(taskPayload)) return [];
    const normalizedTasks = taskPayload.map(normalizeFamilyTask).filter(Boolean);
    return normalizedTasks;
  } catch {
    return [];
  }
}

export async function persistFamilyTasks(tasks) {
  const normalizedTasks = Array.isArray(tasks) ? tasks.map(normalizeFamilyTask).filter(Boolean) : [];
  try {
    const response = await fetch("/api/family/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: normalizedTasks }),
    });
    if (!response.ok) throw new Error("family task save failed");
    const parsed = await response.json().catch(() => null);
    const savedTasks = Array.isArray(parsed?.tasks)
      ? parsed.tasks.map(normalizeFamilyTask).filter(Boolean)
      : normalizedTasks;
    return true;
  } catch {
    return false;
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

export function formatFamilyTaskDueDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${year}-${month}-${day}(${weekday})까지`;
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
