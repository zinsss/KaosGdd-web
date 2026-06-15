import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const OLD_FAMILY_STRINGS = [
  "고치까",
  "치아라",
  "다했데이",
  "도로묵이다",
  "고마하자",
  "안하면 죽는다",
  "왠만하면 빨리해라",
];

test("family tasks use local structured task storage with manual order", async () => {
  const taskHelperSource = await readFile(new URL("../app/family/familyTasks.js", import.meta.url), "utf8");

  for (const value of ["kaosgdd.family.tasks.v1", "내 할 일", "쏭 할 일", "전체", "😐 보통", "🙂 조금 빨리", "⭐ 중요"]) {
    assert.ok(taskHelperSource.includes(value));
  }
  for (const field of ["id", "title", "description", "assignee", "priority", "due_date", "done", "sort_order", "created_at", "updated_at", "completed_at"]) {
    assert.ok(taskHelperSource.includes(field));
  }
  assert.ok(taskHelperSource.includes("fallbackSortOrder"));
  assert.ok(taskHelperSource.includes("sort_order: sortOrder"));
  assert.ok(taskHelperSource.includes("orderA !== orderB"));
  assert.ok(taskHelperSource.includes("localStorage.getItem"));
  assert.ok(taskHelperSource.includes("localStorage.setItem"));
  assert.ok(taskHelperSource.includes("sortActiveFamilyTasks"));
  assert.ok(taskHelperSource.includes("sortDoneFamilyTasks"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!taskHelperSource.includes(oldString));
});

test("family dashboard renders calendar, active task cards, drag handles, and emoji-only badges", async () => {
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const dashboardPageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(dashboardPageSource.includes("FamilyDashboardClient"));
  for (const text of ["달력", "로우니 시간표", "할 일", "+ 할 일", "완료", "개 남음", "☰", "□", "✎", "/family/calendar", "/family/tasks/new", "/family/tasks/done"]) {
    assert.ok(dashboardSource.includes(text));
  }
  assert.ok(!dashboardSource.includes('aria-label="뭔일"'));
  assert.ok(!dashboardSource.includes("뭔일이고"));
  for (const value of [
    "tasks.filter((task) => !task.done)",
    "sortActiveFamilyTasks",
    "function completeTask",
    "function moveTaskId",
    "function reorderActiveTasks",
    "function startTaskDrag",
    "function enterTaskDropTarget",
    "function dropTaskOnTarget",
    "function endTaskDrag",
    "function getTaskCardBadges",
    "function getPriorityEmoji",
    "FAMILY_TASK_DEFAULT_ASSIGNEE",
    "FAMILY_TASK_DEFAULT_PRIORITY",
    "FAMILY_TASK_PRIORITIES",
    "FAMILY_TASK_PRIORITY_ASSIGNEE",
    "setDraggingTaskId",
    "setDragOverTaskId",
    "event.dataTransfer.setData",
    "sort_order: orderById.get(task.id)",
    "className=\"familyTaskDragHandle\"",
    "draggable",
    "onDragStart={(event) => startTaskDrag(event, task.id)}",
    "onDrop={(event) => dropTaskOnTarget(event, task.id)}",
    "familyTaskDateBadge",
    "familyTaskBadge",
    "familyTaskBadgeSelf",
    "familyTaskBadgePriority",
    "familyTaskBadgeAny",
    "label: \"👸🏻\"",
    "label: \"👫\"",
    "getPriorityEmoji(task.priority)",
    "done: true",
    "completed_at: now",
    "/family/tasks/${task.id}/edit",
  ]) assert.ok(dashboardSource.includes(value));
  for (const priority of ["😐", "🙂", "⭐"]) assert.ok(dashboardSource.includes(priority) || dashboardSource.includes("FAMILY_TASK_PRIORITIES"));
  assert.ok(!dashboardSource.includes('label: "니가"'));
  assert.ok(!dashboardSource.includes('label: "아무나"'));
  assert.ok(!dashboardSource.includes('label: "내가"'));
  assert.ok(dashboardSource.includes("if (assignee === FAMILY_TASK_PRIORITY_ASSIGNEE)"));
  assert.ok(dashboardSource.includes("return [{ className: \"familyTaskBadgePriority\""));
  assert.ok(dashboardSource.includes("if (assignee === \"전체\")"));
  assert.ok(!dashboardSource.includes("familyTaskAssigneeBadge"));
  assert.ok(!dashboardSource.includes("<article draggable"));
  assert.ok(dashboardSource.indexOf('className="familyTaskEdit"') < dashboardSource.indexOf('className="familyTaskDragHandle"'));
  for (const selector of [
    ".familyTaskSection",
    ".familyDashboardPanel",
    ".familyTaskCard",
    ".familyTaskDragHandle",
    ".familyTaskCardDragging",
    ".familyTaskCardDropTarget",
    ".familyTaskCheck",
    ".familyTaskEdit",
    ".familyTaskDateBadge",
    ".familyTaskBadge",
    ".familyTaskBadgeSelf",
    ".familyTaskBadgePriority",
    ".familyTaskBadgeAny",
  ]) assert.ok(taskCss.includes(selector));
  assert.ok(!taskCss.includes(".familyTaskAssigneeBadge"));
  assert.ok(taskCss.includes("grid-template-columns: 32px minmax(0, 1fr) 28px 28px"));
  assert.ok(taskCss.includes("cursor: grab"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!dashboardSource.includes(oldString));
});

test("family task add and edit forms validate, save, cancel, and delete", async () => {
  const newPageSource = await readFile(new URL("../app/family/tasks/new/page.js", import.meta.url), "utf8");
  const editPageSource = await readFile(new URL("../app/family/tasks/[id]/edit/page.js", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../app/family/tasks/FamilyTaskFormClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.ok(newPageSource.includes("FamilyTaskFormClient"));
  assert.ok(editPageSource.includes("taskId={id}"));
  assert.ok(formSource.includes("FamilyHeader"));
  for (const text of ["할 일 추가", "할 일 수정", "제목 *", "설명", "담당자", "날짜", "저장", "취소", "삭제", "제목을 입력해주세요."]) {
    assert.ok(formSource.includes(text));
  }
  for (const value of ["FAMILY_TASK_ASSIGNEES.map", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE", "FAMILY_TASK_PRIORITIES.map", "FAMILY_TASK_DEFAULT_PRIORITY", "draft.assignee === FAMILY_TASK_PRIORITY_ASSIGNEE", "className=\"familyTaskPriorityField\"", "className=\"familyTaskDateInput\"", "const title = draft.title.trim();", "normalizeFamilyTask", "createFamilyTaskId()", "done: false", "nextTask", "tasks.map((task) =>", "tasks.filter((task) => task.id !== taskId)"]) {
    assert.ok(formSource.includes(value));
  }
  assert.doesNotMatch(formSource, /window\.confirm/);
  for (const selector of [".familyTaskForm", ".familyTaskPageTitle", ".familyTaskFormGrid", ".familyTaskFormError"]) assert.ok(taskCss.includes(selector));
  for (const value of [".familyTaskDateInput", "max-width: 100%", "min-width: 0", "box-sizing: border-box", ".familyTaskPriorityField", "grid-column: 1 / -1", "grid-template-columns: minmax(0, 1fr)"]) assert.ok(polishCss.includes(value));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!formSource.includes(oldString));
});

test("family done archive renders newest completed tasks and supports restore/delete", async () => {
  const donePageSource = await readFile(new URL("../app/family/tasks/done/page.js", import.meta.url), "utf8");
  const doneSource = await readFile(new URL("../app/family/tasks/done/FamilyDoneTasksClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(donePageSource.includes("FamilyDoneTasksClient"));
  for (const text of ["완료", "완료 취소", "삭제"]) assert.ok(doneSource.includes(text));
  for (const value of ["FamilyHeader", "tasks.filter((task) => task.done)", "sortDoneFamilyTasks", "function restoreTask", "done: false", 'completed_at: ""', "function deleteTask", "current.filter((task) => task.id !== taskId)", "formatFamilyDateTime"]) {
    assert.ok(doneSource.includes(value));
  }
  for (const selector of [".familyDoneTasks", ".familyDoneTaskRow", ".familyDoneTaskActions"]) assert.ok(taskCss.includes(selector));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!doneSource.includes(oldString));
});
