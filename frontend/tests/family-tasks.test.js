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

  for (const label of ["할일", "+ 할일", "완료한 할일", "완료", "완료 취소", "저장", "취소", "삭제", "쏭"]) {
    assert.ok(combinedSource.includes(label), `${label} should appear in Family task sources`);
  }

  for (const priority of ["💤 언젠가는", "😄 보통", "⭐️ 중요", "‼️ 꼭 하기"]) {
    assert.ok(combinedSource.includes(priority), `${priority} should appear in Family task sources`);
  }
  for (const oldPriority of ["💤 언젠가는...", "⭐️ 중요! 늦지않기", "‼️ 꼭! 죽어도 하기"]) {
    assert.ok(!combinedSource.includes(oldPriority), `${oldPriority} should not remain as a visible priority label`);
  }

  for (const value of ["kaosgdd.family.tasks.v1", "sort_order", "completed_at", "FAMILY_TASK_DEFAULT_ASSIGNEE", "FAMILY_TASK_PRIORITY_ASSIGNEE"]) {
    assert.ok(combinedSource.includes(value));
  }
  for (const selector of [".familyTaskSection", ".familyTaskCard", ".familyTaskForm", ".familyDoneTaskRow"]) {
    assert.ok(taskCss.includes(selector));
  }
  assert.ok(dashboardSource.includes("const [expandedTaskId, setExpandedTaskId] = useState(\"\");"), "task rows should expand only when selected");
  assert.ok(dashboardSource.includes("aria-expanded={expanded}"), "collapsed task rows should expose expansion state");
  assert.ok(dashboardSource.includes("className=\"familyTaskRowToggle\""), "task row should be the compact one-line toggle");
  assert.ok(!dashboardSource.includes("className=\"familyTaskChecklistLine\""), "task list should no longer render a second checklist line");
  assert.ok(!dashboardSource.includes("className=\"familyTaskInlineCheck\""), "task list completion should not be a second-line control");
  assert.ok(dashboardSource.includes("className=\"familyTaskRowActions\""), "task actions should appear only in expanded rows");
  assert.ok(dashboardSource.includes("familyTaskActionButtonDone"), "done action should have a lavender action style hook");
  assert.ok(dashboardSource.includes("familyTaskActionButtonDanger"), "delete action should have a darker pink action style hook");
  assert.ok(dashboardSource.includes("<h2>할일</h2>"), "Family task page should use the compact 할일 title");
  assert.ok(dashboardSource.includes("formatFamilyTaskDueDate(task.due_date)"), "due dates should use yy-mm-dd(ddd)까지 formatting");
  assert.ok(taskHelperSource.includes("return `${year}-${month}-${day}(${weekday})까지`;"));
  assert.ok(dashboardSource.includes("<h3><span aria-hidden=\"true\">•</span>{task.title}</h3>"), "task title should render as primary bullet line");
  assert.ok(dashboardSource.includes('className="familyTaskMetaBadges"'), "priority and 쏭 meta should render inline beside the title");
  assert.ok(dashboardSource.includes('className="familyTaskDateBadge"'), "due date should render as a right-aligned inline value");
  assert.ok(dashboardSource.includes("function getTaskMemoLines(task)"), "task memo lines should be normalized for checklist display");
  assert.ok(dashboardSource.includes("function toggleTaskMemoLine(taskId, lineIndex)"), "memo checklist lines should be individually checkable");
  assert.ok(dashboardSource.includes("task.memo_checklist"), "memo checklist rendering should depend on the task memo flag");
  assert.ok(dashboardSource.includes('className="familyTaskMemoChecklist"'), "checked memo tasks should render as a checklist");
  assert.ok(dashboardSource.includes("familyTaskMemoCheckItemDone"), "checked memo lines should have a completed style hook");
  assert.ok(dashboardSource.includes("onClick={() => toggleTaskMemoLine(task.id, lineIndex)}"), "memo checklist lines should toggle in place");
  assert.ok(dashboardSource.includes('className="familyTaskMemoText"'), "plain memo tasks should still render memo text");
  assert.ok(dashboardSource.includes('familyTaskPriorityEmoji'), "task list should render priority as emoji-only text");
  assert.ok(dashboardSource.includes('String(priority).trim().split(/\\s+/)[0]'), "task list should strip priority title text");
  assert.ok(dashboardSource.includes('familyTaskSongText'), "쏭 should render as accented text only for shared tasks");
  assert.ok(!dashboardSource.includes("familyTaskBadge "), "task list should not render priority or 쏭 as badge pills");
  assert.ok(!dashboardSource.includes("familyTaskBadgeSong"), "쏭 list display should not use a badge pill");
  assert.doesNotMatch(dashboardSource, /FAMILY_TASK_PRIORITIES\.map/);
  assert.ok(!dashboardSource.includes("우선순위:"), "task list should not render a priority label prefix");
  assert.ok(!dashboardSource.includes("familyCalendarDashboardCard"), "Family task page should not render a calendar dashboard card");
  assert.ok(!dashboardSource.includes("일정과 로운이 시간표를 함께 봐요."), "Family task page should not render calendar helper copy");
  assert.ok(!formSource.includes("<span>담당자</span>"), "task form should not render the assignee label");
  assert.ok(!formSource.includes("FAMILY_TASK_ASSIGNEES.map"), "task form should not render the assignee combobox");
  assert.ok(formSource.includes('className="familyTaskMemoLabelRow"'), "memo label should include the checklist checkbox beside the title");
  assert.ok(formSource.includes('className="familyTaskMemoChecklistToggle"'), "memo checklist should have a compact toggle control");
  assert.ok(formSource.includes('type="checkbox"'), "memo checklist should use a native checkbox");
  assert.ok(formSource.includes('checked={Boolean(draft.memo_checklist)}'), "memo checklist checkbox should bind to draft state");
  assert.ok(taskHelperSource.includes("memo_checklist"), "task normalization should persist the memo checklist flag");
  assert.ok(taskHelperSource.includes("memo_checks"), "task normalization should persist per-line memo check state");
  assert.ok(formSource.includes('className="familyTaskPriorityShareRow"'), "priority and 쏭 controls should share one row");
  assert.ok(formSource.includes('className={`familyTaskSongToggle${sharedWithSong ? " familyTaskSongToggleActive" : ""}`}'), "task form should render the 쏭 toggle button");
  assert.ok(formSource.includes("aria-pressed={sharedWithSong}"), "쏭 toggle should expose pressed state");
  assert.ok(formSource.includes("onClick={() => updateSongShared(!sharedWithSong)}"), "쏭 toggle should flip the same shared assignee state");
  assert.ok(formSource.includes("priority: FAMILY_TASK_DEFAULT_PRIORITY"), "new task default priority should be 보통");
  assert.ok(taskCss.includes(".familyTaskRowToggle"));
  assert.ok(!taskCss.includes(".familyTaskTitleToggle"));
  assert.ok(!taskCss.includes(".familyTaskChecklistLine"));
  assert.ok(!taskCss.includes(".familyTaskInlineCheck"));
  assert.ok(taskCss.includes(".familyTaskRowActions"));
  assert.match(taskCss, /\.familyTaskCardBody\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
  assert.match(taskCss, /\.familyTaskCard h3\s*\{[\s\S]*?flex:\s*1 1 12rem;[\s\S]*?min-width:\s*0;[\s\S]*?text-overflow:\s*ellipsis;/);
  assert.match(taskCss, /\.familyTaskMeta\s*\{[\s\S]*?display:\s*flex;[\s\S]*?margin-left:\s*auto;[\s\S]*?min-width:\s*0;/);
  assert.match(taskCss, /\.familyTaskMetaBadges\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(taskCss, /\.familyTaskDateBadge\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*rgba\(78, 37, 54, 0\.46\);/);
  assert.match(taskCss, /\.familyTaskPriorityEmoji,\s*\n\.familyTaskSongText\s*\{[\s\S]*?display:\s*inline;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*0;[\s\S]*?box-shadow:\s*none;/);
  assert.match(taskCss, /\.familyTaskSongText\s*\{[\s\S]*?color:\s*#d86f98;[\s\S]*?font-weight:\s*950;/);
  assert.match(taskCss, /\.familyTaskMemoChecklist\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*6px;/);
  assert.match(taskCss, /\.familyTaskMemoCheckItem\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?text-align:\s*left;/);
  assert.match(taskCss, /\.familyTaskMemoCheckBox\s*\{[\s\S]*?width:\s*17px;[\s\S]*?height:\s*17px;[\s\S]*?box-shadow:\s*inset 0 0 0 1\.5px rgba\(216, 111, 152, 0\.42\);/);
  assert.match(taskCss, /\.familyTaskMemoLabelRow\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/);
  assert.match(taskCss, /\.familyTaskForm \.familyTaskMemoChecklistToggle\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
  assert.match(taskCss, /\.familyTaskForm \.familyTaskMemoChecklistToggle input\s*\{[\s\S]*?width:\s*16px;[\s\S]*?min-height:\s*16px;[\s\S]*?accent-color:\s*#d86f98;/);
  assert.ok(!taskCss.includes(".familyTaskBadgeSong"), "쏭 list display should not have badge styling");
  assert.ok(!taskCss.includes(".familyTaskBadgePriority"), "priority list display should not have badge styling");
  assert.match(taskCss, /\.familyTaskPriorityShareRow\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?align-items:\s*end;/);
  assert.match(taskCss, /\.familyTaskSongToggle\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?min-width:\s*72px;[\s\S]*?min-height:\s*42px;[\s\S]*?padding:\s*0 14px;/);
  assert.match(taskCss, /\.familyTaskSongToggleActive\s*\{[\s\S]*?background:\s*rgba\(255,\s*232,\s*241,\s*0\.92\);[\s\S]*?color:\s*#9d3657;/);
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
