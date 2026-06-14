import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family tasks use local structured task storage", async () => {
  const taskHelperSource = await readFile(new URL("../app/family/familyTasks.js", import.meta.url), "utf8");

  assert.ok(taskHelperSource.includes("kaosgdd.family.tasks.v1"));
  for (const value of ["엄마", "아빠", "모두"]) assert.ok(taskHelperSource.includes(value));
  for (const field of ["id", "title", "description", "assignee", "due_date", "done", "created_at", "updated_at", "completed_at"]) {
    assert.ok(taskHelperSource.includes(field));
  }
  assert.ok(taskHelperSource.includes("localStorage.getItem"));
  assert.ok(taskHelperSource.includes("localStorage.setItem"));
  assert.ok(taskHelperSource.includes("sortActiveFamilyTasks"));
  assert.ok(taskHelperSource.includes("sortDoneFamilyTasks"));
});

test("family dashboard renders active task cards and completion flow", async () => {
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const dashboardPageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(dashboardPageSource.includes("FamilyDashboardClient"));
  for (const text of ["뭔날", "뭔일", "뭔일이고", "하그라", "+ 하그라", "다했데이", "개 남음", "□", "✎"]) assert.ok(dashboardSource.includes(text));
  assert.ok(dashboardSource.includes("tasks.filter((task) => !task.done)"));
  assert.ok(dashboardSource.includes("sortActiveFamilyTasks"));
  assert.ok(dashboardSource.includes("function completeTask"));
  assert.ok(dashboardSource.includes("done: true"));
  assert.ok(dashboardSource.includes("completed_at: now"));
  assert.ok(dashboardSource.includes("/family/tasks/new"));
  assert.ok(dashboardSource.includes("/family/tasks/done"));
  assert.ok(dashboardSource.includes("/family/tasks/${task.id}/edit"));
  for (const selector of [".familyTaskSection", ".familyDashboardPanel", ".familyTaskCard", ".familyTaskCheck", ".familyTaskEdit"]) {
    assert.ok(taskCss.includes(selector));
  }
});

test("family task add and edit forms validate, save, cancel, and delete", async () => {
  const newPageSource = await readFile(new URL("../app/family/tasks/new/page.js", import.meta.url), "utf8");
  const editPageSource = await readFile(new URL("../app/family/tasks/[id]/edit/page.js", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../app/family/tasks/FamilyTaskFormClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(newPageSource.includes("FamilyTaskFormClient"));
  assert.ok(newPageSource.includes("하그라 - KaosGdd"));
  assert.ok(editPageSource.includes("await params"));
  assert.ok(editPageSource.includes("taskId={id}"));
  assert.ok(editPageSource.includes("고치까 - KaosGdd"));
  assert.ok(formSource.includes("FamilyHeader"));
  for (const text of ["하그라", "고치까", "제목 *", "설명", "담당자", "날짜", "되따", "고마하자", "치아라", "제목을 입력해주세요."]) {
    assert.ok(formSource.includes(text));
  }
  assert.ok(formSource.includes("FAMILY_TASK_ASSIGNEES"));
  assert.ok(formSource.includes("FAMILY_TASK_ASSIGNEES.map"));
  assert.ok(formSource.includes("const title = draft.title.trim();"));
  assert.ok(formSource.includes("normalizeFamilyTask"));
  assert.ok(formSource.includes("createFamilyTaskId()"));
  assert.ok(formSource.includes("done: false"));
  assert.ok(formSource.includes("nextTask"));
  assert.ok(formSource.includes("tasks.map((task) =>"));
  assert.ok(formSource.includes("tasks.filter((task) => task.id !== taskId)"));
  assert.doesNotMatch(formSource, /window\.confirm/);
  for (const selector of [".familyTaskForm", ".familyTaskPageTitle", ".familyTaskFormGrid", ".familyTaskFormError"]) {
    assert.ok(taskCss.includes(selector));
  }
});

test("family done archive renders newest completed tasks and supports restore/delete", async () => {
  const donePageSource = await readFile(new URL("../app/family/tasks/done/page.js", import.meta.url), "utf8");
  const doneSource = await readFile(new URL("../app/family/tasks/done/FamilyDoneTasksClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.ok(donePageSource.includes("FamilyDoneTasksClient"));
  assert.ok(donePageSource.includes("다했데이 - KaosGdd"));
  for (const text of ["다했데이", "도로묵이다", "치아라"]) assert.ok(doneSource.includes(text));
  assert.ok(doneSource.includes("FamilyHeader"));
  assert.ok(doneSource.includes("tasks.filter((task) => task.done)"));
  assert.ok(doneSource.includes("sortDoneFamilyTasks"));
  assert.ok(doneSource.includes("function restoreTask"));
  assert.ok(doneSource.includes("done: false"));
  assert.ok(doneSource.includes('completed_at: ""'));
  assert.ok(doneSource.includes("function deleteTask"));
  assert.ok(doneSource.includes("current.filter((task) => task.id !== taskId)"));
  assert.ok(doneSource.includes("formatFamilyDateTime"));
  for (const selector of [".familyDoneTasks", ".familyDoneTaskRow", ".familyDoneTaskActions"]) {
    assert.ok(taskCss.includes(selector));
  }
});
