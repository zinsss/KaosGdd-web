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

test("family tasks use finalized standard Korean labels", async () => {
  const taskHelperSource = await readSource("../app/family/familyTasks.js");
  const dashboardSource = await readSource("../app/family/FamilyDashboardClient.js");
  const formSource = await readSource("../app/family/tasks/FamilyTaskFormClient.js");
  const doneSource = await readSource("../app/family/tasks/done/FamilyDoneTasksClient.js");
  const taskCss = await readSource("../app/styles/family-tasks.css");
  const polishCss = await readSource("../app/styles/family-polish.css");
  const combinedSource = `${taskHelperSource}\n${dashboardSource}\n${formSource}\n${doneSource}`;

  for (const label of [
    "전체",
    "내 할 일",
    "쏭 할 일",
    "할 일",
    "+ 할 일",
    "완료",
    "완료 취소",
    "저장",
    "취소",
    "삭제",
    "제목을 입력해주세요.",
  ]) assert.ok(combinedSource.includes(label));

  for (const value of ["kaosgdd.family.tasks.v1", "sort_order", "completed_at", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE"]) {
    assert.ok(combinedSource.includes(value));
  }
  for (const selector of [".familyTaskSection", ".familyTaskCard", ".familyTaskForm", ".familyDoneTaskRow"]) {
    assert.ok(taskCss.includes(selector));
  }
  assert.ok(polishCss.includes(".familyTaskDateInput"));
  assert.ok(polishCss.includes("max-width: 100%"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!combinedSource.includes(oldString));
});
