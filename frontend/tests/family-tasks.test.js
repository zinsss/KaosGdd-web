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

  for (const label of ["전체", "내 할 일", "쏭 할 일", "할일", "+ 할일", "완료한 할일", "완료", "완료 취소", "저장", "취소", "삭제"]) {
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
  assert.ok(dashboardSource.includes("familyTaskActionButtonDone"), "done action should have a lavender action style hook");
  assert.ok(dashboardSource.includes("familyTaskActionButtonDanger"), "delete action should have a darker pink action style hook");
  assert.ok(dashboardSource.includes("<h2>할일</h2>"), "Family task page should use the compact 할일 title");
  assert.ok(dashboardSource.includes("formatFamilyDate(task.due_date)"), "due dates should remain compact inline text");
  assert.ok(!dashboardSource.includes("familyCalendarDashboardCard"), "Family task page should not render a calendar dashboard card");
  assert.ok(!dashboardSource.includes("일정과 로운이 시간표를 함께 봐요."), "Family task page should not render calendar helper copy");
  assert.ok(taskCss.includes(".familyTaskRowToggle"));
  assert.ok(taskCss.includes(".familyTaskRowActions"));
  assert.match(taskCss, /\.familyTaskHeaderActions\s*\{[\s\S]*?flex-wrap:\s*nowrap;/);
  assert.match(taskCss, /\.familyTaskRowActions\s*\{[\s\S]*?flex-wrap:\s*nowrap;/);
  assert.match(taskCss, /\.familyTaskActionButtonDone\s*\{[\s\S]*?background:\s*rgba\(245,\s*235,\s*255,\s*0\.86\);[\s\S]*?color:\s*rgba\(110,\s*75,\s*145,\s*0\.9\);/);
  assert.match(taskCss, /\.familyTaskActionButtonDanger\s*\{[\s\S]*?background:\s*rgba\(255,\s*232,\s*241,\s*0\.88\);[\s\S]*?color:\s*rgba\(150,\s*58,\s*92,\s*0\.94\);/);
  assert.match(taskCss, /@media \(max-width:\s*360px\)\s*\{[\s\S]*?\.familyTaskHeaderActions,[\s\S]*?\.familyTaskRowActions\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(taskCss, /\.familyTaskPageCard\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(taskCss, /\.familyTaskForm,[\s\S]*?\.familyDoneTasks\s*\{[\s\S]*?width:\s*calc\(100% - 32px\);[\s\S]*?max-width:\s*calc\(100% - 32px\);[\s\S]*?min-width:\s*0;[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(taskCss, /\.familyTaskForm input,[\s\S]*?\.familyTaskForm select,[\s\S]*?\.familyTaskForm textarea\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(taskCss, /\.familyTaskFormGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(taskCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.familyTaskForm,[\s\S]*?\.familyDoneTasks\s*\{[\s\S]*?width:\s*calc\(100% - 24px\);[\s\S]*?max-width:\s*calc\(100% - 24px\);/);
  assert.match(taskCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.familyTaskFormGrid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.ok(!taskCss.includes("width: 100vw"), "Family task form CSS should not use 100vw inside padded containers");
  assert.ok(polishCss.includes(".familyTaskDateInput"));
  assert.ok(polishCss.includes("max-width: 100%"));
  assert.match(polishCss, /\.familyTaskForm,[\s\S]*?\.familyDoneTasks\s*\{[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*calc\(100% - 32px\);[\s\S]*?overflow:\s*hidden;/);
  assert.match(polishCss, /\.familyTaskFormActions,[\s\S]*?\.familyDoneTaskActions,[\s\S]*?\.familyTaskHeaderActions\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?max-width:\s*100%;/);
  assert.match(polishCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.familyTaskForm,[\s\S]*?\.familyDoneTasks\s*\{[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*calc\(100% - 24px\);[\s\S]*?margin:\s*12px;/);
  assert.match(polishCss, /\.familyTaskHeaderActions,[\s\S]*?\.familyTaskRowActions,[\s\S]*?\.familyTaskFormActions\s*\{[\s\S]*?flex-direction:\s*row;[\s\S]*?flex-wrap:\s*nowrap;/);
  assert.match(polishCss, /\.familyTaskHeaderActions \.familyTaskActionButton,[\s\S]*?\.familyTaskRowActions \.familyTaskActionButton,[\s\S]*?\.familyTaskFormActions \.familyTaskSave,[\s\S]*?\.familyTaskFormActions \.familyTaskCancel,[\s\S]*?\.familyTaskFormActions \.familyTaskDelete\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?width:\s*auto;/);
  assert.match(polishCss, /@media \(max-width:\s*340px\)\s*\{[\s\S]*?\.familyTaskHeaderActions,[\s\S]*?\.familyTaskRowActions,[\s\S]*?\.familyTaskFormActions\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.ok(!polishCss.includes("width: 100vw"), "Family polish CSS should not use 100vw for task forms");

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자", "안하면 죽는다", "왠만하면 빨리해라", "니가 해라", "내가 하께", "아무나 하자"]) {
    assert.ok(!combinedSource.includes(oldString), `${oldString} should not remain in Family task UI`);
  }
});
