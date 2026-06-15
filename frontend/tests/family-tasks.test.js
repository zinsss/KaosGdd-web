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
  "니가 해라",
  "내가 하께",
  "아무나 하자",
];

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family tasks use finalized local task labels and storage", async () => {
  const taskHelperSource = await readSource("../app/family/familyTasks.js");

  for (const value of ["kaosgdd.family.tasks.v1", "내 할 일", "쏭 할 일", "전체", "😐 보통", "🙂 조금 빨리", "⭐ 중요"]) {
    assert.ok(taskHelperSource.includes(value));
  }
  for (const field of ["id", "title", "description", "assignee", "priority", "due_date", "done", "sort_order", "created_at", "updated_at", "completed_at"]) {
    assert.ok(taskHelperSource.includes(field));
  }
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!taskHelperSource.includes(oldString));
});

test("family dashboard renders calendar, active tasks, ordering handle, and emoji badges", async () => {
  const dashboardSource = await readSource("../app/family/FamilyDashboardClient.js");
  const dashboardPageSource = await readSource("../app/family/page.js");
  const taskCss = await readSource("../app/styles/family-tasks.css");

  assert.ok(dashboardPageSource.includes("FamilyDashboardClient"));
  for (const text of ["달력", "로우니 시간표", "할 일", "+ 할 일", "완료", "개 남음", "☰", "□", "✎", "/family/calendar", "/family/tasks/new", "/family/tasks/done"]) {
    assert.ok(dashboardSource.includes(text));
  }
  for (const value of ["sortActiveFamilyTasks", "function completeTask", "function reorderActiveTasks", "function getTaskCardBadges", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE", "className=\"familyTaskDragHandle\"", "draggable", "familyTaskBadge"]) {
    assert.ok(dashboardSource.includes(value));
  }
  for (const badge of ["👸🏻", "👫"]) assert.ok(dashboardSource.includes(badge));
  assert.ok(dashboardSource.includes("getPriorityEmoji(task.priority)"));
  for (const selector of [".familyTaskSection", ".familyTaskCard", ".familyTaskDragHandle", ".familyTaskBadge"]) assert.ok(taskCss.includes(selector));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!dashboardSource.includes(oldString));
});

test("family task add and edit forms use finalized standard labels", async () => {
  const newPageSource = await readSource("../app/family/tasks/new/page.js");
  const editPageSource = await readSource("../app/family/tasks/[id]/edit/page.js");
  const formSource = await readSource("../app/family/tasks/FamilyTaskFormClient.js");
  const taskCss = await readSource("../app/styles/family-tasks.css");
  const polishCss = await readSource("../app/styles/family-polish.css");

  assert.ok(newPageSource.includes("FamilyTaskFormClient"));
  assert.ok(editPageSource.includes("taskId={id}"));
  for (const text of ["할 일 추가", "할 일 수정", "제목 *", "설명", "담당자", "중요도", "날짜", "저장", "취소", "삭제", "제목을 입력해주세요."]) {
    assert.ok(formSource.includes(text));
  }
  for (const value of ["FAMILY_TASK_ASSIGNEES.map", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE", "FAMILY_TASK_PRIORITIES.map", "draft.assignee === FAMILY_TASK_PRIORITY_ASSIGNEE", "className=\"familyTaskDateInput\""]) {
    assert.ok(formSource.includes(value));
  }
  assert.ok(taskCss.includes(".familyTaskForm"));
  assert.ok(polishCss.includes(".familyTaskDateInput"));
  assert.ok(polishCss.includes("max-width: 100%"));
  assert.ok(polishCss.includes("min-width: 0"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!formSource.includes(oldString));
});

test("family done archive uses finalized restore and delete labels", async () => {
  const donePageSource = await readSource("../app/family/tasks/done/page.js");
  const doneSource = await readSource("../app/family/tasks/done/FamilyDoneTasksClient.js");
  const taskCss = await readSource("../app/styles/family-tasks.css");

  assert.ok(donePageSource.includes("FamilyDoneTasksClient"));
  for (const text of ["완료", "완료 취소", "삭제"]) assert.ok(doneSource.includes(text));
  for (const value of ["FamilyHeader", "tasks.filter((task) => task.done)", "sortDoneFamilyTasks", "function restoreTask", "done: false", "function deleteTask"]) {
    assert.ok(doneSource.includes(value));
  }
  for (const selector of [".familyDoneTasks", ".familyDoneTaskRow", ".familyDoneTaskActions"]) assert.ok(taskCss.includes(selector));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!doneSource.includes(oldString));
});
