import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family tasks use local structured task storage", async () => {
  const taskHelperSource = await readFile(new URL("../app/family/familyTasks.js", import.meta.url), "utf8");

  assert.match(taskHelperSource, /FAMILY_TASKS_STORAGE_KEY = "kaosgdd\.family\.tasks\.v1"/);
  assert.match(taskHelperSource, /FAMILY_TASK_ASSIGNEES = \["엄마", "아빠", "모두"\]/);
  for (const field of ["id", "title", "description", "assignee", "due_date", "done", "created_at", "updated_at"]) {
    assert.match(taskHelperSource, new RegExp(`${field}:`));
  }
  assert.match(taskHelperSource, /completed_at/);
  assert.match(taskHelperSource, /window\.localStorage\.getItem\(FAMILY_TASKS_STORAGE_KEY\)/);
  assert.match(taskHelperSource, /window\.localStorage\.setItem\(FAMILY_TASKS_STORAGE_KEY, JSON\.stringify\(tasks\)\)/);
  assert.match(taskHelperSource, /function sortActiveFamilyTasks\(tasks\)/);
  assert.match(taskHelperSource, /function sortDoneFamilyTasks\(tasks\)/);
});

test("family dashboard renders active task cards and completion flow", async () => {
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const dashboardPageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.match(dashboardPageSource, /FamilyDashboardClient/);
  assert.match(dashboardSource, /할 일/);
  assert.match(dashboardSource, /\+ 추가/);
  assert.match(dashboardSource, /완료 보기/);
  assert.match(dashboardSource, /개 남음/);
  assert.match(dashboardSource, /tasks\.filter\(\(task\) => !task\.done\)/);
  assert.match(dashboardSource, /sortActiveFamilyTasks/);
  assert.match(dashboardSource, /function completeTask\(taskId\)/);
  assert.match(dashboardSource, /done:\s*true/);
  assert.match(dashboardSource, /completed_at:\s*now/);
  assert.match(dashboardSource, /\/family\/tasks\/new/);
  assert.match(dashboardSource, /\/family\/tasks\/done/);
  assert.match(dashboardSource, /\/family\/tasks\/\$\{task\.id\}\/edit/);
  assert.match(dashboardSource, /□/);
  assert.match(dashboardSource, /✎/);
  assert.match(taskCss, /\.familyTaskSection/);
  assert.match(taskCss, /\.familyTaskCard[\s\S]*?\{/);
  assert.match(taskCss, /\.familyTaskCheck/);
  assert.match(taskCss, /\.familyTaskEdit/);
});

test("family task add and edit forms validate, save, cancel, and delete", async () => {
  const newPageSource = await readFile(new URL("../app/family/tasks/new/page.js", import.meta.url), "utf8");
  const editPageSource = await readFile(new URL("../app/family/tasks/[id]/edit/page.js", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../app/family/tasks/FamilyTaskFormClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.match(newPageSource, /FamilyTaskFormClient/);
  assert.match(editPageSource, /await params/);
  assert.match(editPageSource, /taskId=\{id\}/);
  assert.match(formSource, /제목 \*/);
  assert.match(formSource, /설명/);
  assert.match(formSource, /담당자/);
  assert.match(formSource, /날짜/);
  assert.match(formSource, /저장/);
  assert.match(formSource, /취소/);
  assert.match(formSource, /삭제/);
  assert.match(formSource, /const title = draft\.title\.trim\(\);/);
  assert.match(formSource, /setError\("제목을 입력해주세요\."\)/);
  assert.match(formSource, /normalizeFamilyTask/);
  assert.match(formSource, /createFamilyTaskId\(\)/);
  assert.match(formSource, /done:\s*false/);
  assert.match(formSource, /saveFamilyTasks\([\s\S]*nextTask[\s\S]*filter\(Boolean\)/);
  assert.match(formSource, /tasks\.map\(\(task\) =>/);
  assert.match(formSource, /saveFamilyTasks\(tasks\.filter\(\(task\) => task\.id !== taskId\)\)/);
  assert.doesNotMatch(formSource, /window\.confirm/);
  for (const assignee of ["엄마", "아빠", "모두"]) {
    assert.match(formSource, new RegExp(assignee));
  }
  assert.match(taskCss, /\.familyTaskForm/);
  assert.match(taskCss, /\.familyTaskFormGrid[\s\S]*?\{/);
  assert.match(taskCss, /\.familyTaskFormError[\s\S]*?\{/);
});

test("family done archive renders newest completed tasks and supports restore/delete", async () => {
  const donePageSource = await readFile(new URL("../app/family/tasks/done/page.js", import.meta.url), "utf8");
  const doneSource = await readFile(new URL("../app/family/tasks/done/FamilyDoneTasksClient.js", import.meta.url), "utf8");
  const taskCss = await readFile(new URL("../app/styles/family-tasks.css", import.meta.url), "utf8");

  assert.match(donePageSource, /FamilyDoneTasksClient/);
  assert.match(doneSource, /완료한 할 일/);
  assert.match(doneSource, /tasks\.filter\(\(task\) => task\.done\)/);
  assert.match(doneSource, /sortDoneFamilyTasks/);
  assert.match(doneSource, /function restoreTask\(taskId\)/);
  assert.match(doneSource, /done:\s*false/);
  assert.match(doneSource, /completed_at:\s*""/);
  assert.match(doneSource, /function deleteTask\(taskId\)/);
  assert.match(doneSource, /current\.filter\(\(task\) => task\.id !== taskId\)/);
  assert.match(doneSource, /복원/);
  assert.match(doneSource, /삭제/);
  assert.match(doneSource, /formatFamilyDateTime/);
  assert.match(taskCss, /\.familyDoneTasks/);
  assert.match(taskCss, /\.familyDoneTaskRow[\s\S]*?\{/);
  assert.match(taskCss, /\.familyDoneTaskActions/);
});
