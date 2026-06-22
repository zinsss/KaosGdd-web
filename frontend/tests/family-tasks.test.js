import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

  for (const label of ["전체", "내 할 일", "쏭 할 일", "할일", "새로 만들기", "완료", "완료 취소", "저장", "취소", "삭제"]) {
    assert.ok(combinedSource.includes(label), `${label} should appear in Family task sources`);
  }

  for (const value of ["kaosgdd.family.tasks.v1", "sort_order", "completed_at", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE"]) {
    assert.ok(combinedSource.includes(value));
  }
  for (const selector of [".familyTaskSection", ".familyTaskCard", ".familyTaskForm", ".familyDoneTaskRow"]) {
    assert.ok(taskCss.includes(selector));
  }
  assert.ok(dashboardSource.includes("const [expandedTaskId, setExpandedTaskId] = useState(\"\");"), "task rows should expand only when selected");
  assert.ok(dashboardSource.includes("aria-expanded={expanded}"), "collapsed task rows should expose expansion state");
  assert.ok(dashboardSource.includes("className=\"familyTaskRowToggle\""), "task rows should be compact toggles by default");
  assert.ok(dashboardSource.includes("className=\"familyTaskRowActions\""), "task actions should appear only in expanded rows");
  assert.ok(dashboardSource.includes("<h2>할일</h2>"), "Family task page should use the compact 할일 title");
  assert.ok(dashboardSource.includes("formatFamilyDate(task.due_date)"), "due dates should remain compact inline text");
  assert.ok(!dashboardSource.includes("familyCalendarDashboardCard"), "Family task page should not render a calendar dashboard card");
  assert.ok(!dashboardSource.includes("일정과 로운이 시간표를 함께 봐요."), "Family task page should not render calendar helper copy");
  assert.ok(taskCss.includes(".familyTaskRowToggle"));
  assert.ok(taskCss.includes(".familyTaskRowActions"));
  assert.ok(polishCss.includes(".familyTaskDateInput"));
  assert.ok(polishCss.includes("max-width: 100%"));

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자", "안하면 죽는다", "왠만하면 빨리해라", "니가 해라", "내가 하께", "아무나 하자"]) {
    assert.ok(!combinedSource.includes(oldString), `${oldString} should not remain in Family task UI`);
  }
});
