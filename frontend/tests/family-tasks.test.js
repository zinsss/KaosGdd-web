import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family tasks use local structured task storage", async () => {
  const taskHelperSource = await readFile(new URL("../app/family/familyTasks.js", import.meta.url), "utf8");

  assert.ok(taskHelperSource.includes("kaosgdd.family.tasks.v1"));
  for (const value of ["내가 하께", "니가 해라", "아무나 하자", "😐 알아서 하그라", "😡 앵간하면 빨리해라이", "🤬 안하면 안될낀데?"]) {
    assert.ok(taskHelperSource.includes(value));
  }
  for (const field of ["id", "title", "description", "assignee", "priority", "due_date", "done", "created_at", "updated_at", "completed_at"]) {
    assert.ok(taskHelperSource.includes(field));
  }
  assert.ok(taskHelperSource.includes("localStorage.getItem"));
  assert.ok(taskHelperSource.includes("localStorage.setItem"));
  assert.ok(taskHelperSource.includes("sortActiveFamilyTasks"));
  assert.ok(taskHelperSource.includes("sortDoneFamilyTasks"));
});

test("family dashboard renders calendar and active task cards", async () => {
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const dashboardPageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(dashboardPageSource.includes("FamilyDashboardClient"));
  for (const text of ["달력", "로니", "하그라", "+ 하그라", "다했데이", "개 남음", "□", "✎", "/family/calendar", "/family/tasks/new", "/family/tasks/done"]) {
    assert.ok(dashboardSource.includes(text));
  }
  assert.ok(!dashboardSource.includes('aria-label="뭔일"'));
  assert.ok(!dashboardSource.includes("뭔일이고"));
  for (const value of ["tasks.filter((task) => !task.done)", "sortActiveFamilyTasks", "function completeTask", "done: true", "completed_at: now", "/family/tasks/${task.id}/edit"]) {
    assert.ok(dashboardSource.includes(value));
  }
  for (const selector of [".familyTaskSection", ".familyDashboardPanel", ".familyTaskCard", ".familyTaskCheck", ".familyTaskEdit"]) {
    assert.ok(taskCss.includes(selector));
  }
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
  for (const text of ["하그라", "고치까", "모할꼬 *", "머라? 좀 더 지끼봐라", "누가하꼬", "언제하꼬", "되따", "고마하자", "치아라", "제목을 입력해주세요."]) {
    assert.ok(formSource.includes(text));
  }
  for (const oldLabel of ["<span>제목 *</span>", "<span>설명</span>", "<span>담당자</span>", "<span>날짜</span>"]) {
    assert.ok(!formSource.includes(oldLabel));
  }
  for (const value of ["FAMILY_TASK_ASSIGNEES.map", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE", "FAMILY_TASK_PRIORITIES.map", "FAMILY_TASK_DEFAULT_PRIORITY", "draft.assignee === FAMILY_TASK_PRIORITY_ASSIGNEE", "className=\"familyTaskPriorityField\"", "className=\"familyTaskDateInput\"", "const title = draft.title.trim();", "normalizeFamilyTask", "createFamilyTaskId()", "done: false", "nextTask", "tasks.map((task) =>", "tasks.filter((task) => task.id !== taskId)"]) {
    assert.ok(formSource.includes(value));
  }
  assert.doesNotMatch(formSource, /window\.confirm/);
  for (const selector of [".familyTaskForm", ".familyTaskPageTitle", ".familyTaskFormGrid", ".familyTaskFormError"]) {
    assert.ok(taskCss.includes(selector));
  }
  for (const value of [".familyTaskDateInput", "max-width: 100%", "min-width: 0", "box-sizing: border-box", ".familyTaskPriorityField", "grid-column: 1 / -1", "grid-template-columns: minmax(0, 1fr)"]) {
    assert.ok(polishCss.includes(value));
  }
});

test("family done archive renders newest completed tasks and supports restore/delete", async () => {
  const donePageSource = await readFile(new URL("../app/family/tasks/done/page.js", import.meta.url), "utf8");
  const doneSource = await readFile(new URL("../app/family/tasks/done/FamilyDoneTasksClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(donePageSource.includes("FamilyDoneTasksClient"));
  for (const text of ["다했데이", "도로묵이다", "치아라"]) assert.ok(doneSource.includes(text));
  for (const value of ["FamilyHeader", "tasks.filter((task) => task.done)", "sortDoneFamilyTasks", "function restoreTask", "done: false", 'completed_at: ""', "function deleteTask", "current.filter((task) => task.id !== taskId)", "formatFamilyDateTime"]) {
    assert.ok(doneSource.includes(value));
  }
  for (const selector of [".familyDoneTasks", ".familyDoneTaskRow", ".familyDoneTaskActions"]) {
    assert.ok(taskCss.includes(selector));
  }
});
