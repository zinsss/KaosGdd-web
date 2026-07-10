import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const FAMILY_TIMETABLE_COLOR_KEYS = [
  "pink",
  "rose",
  "cream",
  "yellow",
  "peach",
  "mint",
  "green",
  "sky",
  "blue",
  "purple",
  "lavender",
  "gray",
];

const FAMILY_TIMETABLE_COLOR_LABELS = [
  "분홍",
  "연분홍",
  "크림",
  "노랑",
  "살구",
  "민트",
  "초록",
  "하늘",
  "파랑",
  "보라",
  "라벤더",
  "회색",
];

test("family timetable keeps local schedule editor foundations", async () => {
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const pickerSource = await readSource("../app/family/calendar/FamilyPickerButton.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const globalsCss = await readSource("../app/globals.css");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  for (const value of [
    "로운이",
    "주간시간표",
    "주간시간표 템플릿",
    "+ 시간표",
    "제목",
    "시간",
    "색상",
    "메모",
    "저장",
    "취소",
    "삭제",
    "제목을 입력해주세요.",
    "이 시간표는 달력 생성에 사용됩니다.",
  ]) {
    assert.ok(rounySource.includes(value), `${value} should remain in Roun timetable editor sources`);
  }

  const weekdaySources = `${rounySource}\n${dataSource}`;
  for (const day of ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(weekdaySources.includes(day), `${day} should remain available to the Roun editor`);
  }
  assert.ok(rounySource.includes("ROUN_WEEKDAY_INDICES = [1, 2, 3, 4, 5, 6]"), "Rouny editor should exclude Sunday");
  for (const value of ["dayOfWeek", "startTime", "endTime", "sessions", "slots", "color", "fontFamily", "normalizeFamilyRounyItem"]) {
    assert.ok(rounySource.includes(value));
  }
  assert.ok(dataSource.includes("Array.isArray(item.sessions)"), "Roun item normalization should accept sessions arrays");
  assert.ok(dataSource.includes("sessions: slots"), "Roun item normalization should preserve normalized sessions");
  assert.ok(rounySource.includes("function rounySessions(item)"), "Roun editor should normalize legacy slots and sessions together");
  assert.ok(rounySource.includes("return rounySessions(item).flatMap((slot, slotIndex) => {"), "each session should render as an independent timetable block");
  assert.ok(rounySource.includes("...item,"), "each rendered session block should retain the parent item fields");
  assert.ok(rounySource.includes("setDraft(rounyToDraft(block));"), "editing any session block should open the shared parent item draft");
  assert.ok(rounySource.includes('className="familyRounyTimePickerRow"'));
  assert.ok(rounySource.includes('className="familyRounySessionList"'));
  assert.ok(rounySource.includes('className="familyRounySessionListLabel">시간</span>'));
  assert.ok(rounySource.includes('className="familyTaskActionButton familyRounySessionAdd"'));
  assert.ok(rounySource.includes("+ 요일/시간"));
  assert.ok(rounySource.includes("function addDraftSession()"));
  assert.ok(rounySource.includes("function removeDraftSession(sessionIndex)"));
  assert.ok(rounySource.includes("if (!current || (current.sessions || []).length <= 1) return current;"));
  assert.ok(rounySource.includes("function shortWeekdayLabel(dayOfWeek)"));
  assert.ok(rounySource.includes('className="familyCalendarPickerButton familyRounyWeekdayPickerButton"'));
  assert.ok(rounySource.includes("FamilySelectPickerButton"), "Rouny weekday control should use shared fallback picker");
  assert.ok(rounySource.includes("FamilyTimePickerButton"), "Rouny time controls should use shared fallback picker");
  assert.ok(rounySource.includes('ariaLabel="로운이 일정 요일 선택"'));
  assert.ok(!rounySource.includes('<span className="familyCalendarDateTimeDivider" aria-hidden="true">,</span>'));
  assert.ok(!rounySource.includes('<span className="familyCalendarDateTimeDivider" aria-hidden="true">|</span>'));
  assert.equal((rounySource.match(/className="familyCalendarPickerButton familyRounyTimePickerButton"/g) || []).length, 2);
  assert.ok(rounySource.includes('ariaLabel="로운이 일정 시작 시간 선택"'));
  assert.ok(rounySource.includes('ariaLabel="로운이 일정 끝 시간 선택"'));
  assert.ok(!rounySource.includes('<input type="time" value={draft.startTime}'));
  assert.ok(!rounySource.includes('<input type="time" value={draft.endTime}'));
  assert.ok(!rounySource.includes('<select value={draft.dayOfWeek}'));
  assert.ok(!rounySource.includes("familyCalendarNativePickerInput"));
  assert.ok(pickerSource.includes("buildFamilyTimeOptions"));
  assert.ok(pickerSource.includes("familyCalendarPickerFallbackSelect"));
  assert.ok(!rounySource.includes("FAMILY_TIMETABLE_FONT_PRESETS"));
  assert.ok(!rounySource.includes("<span>글씨체</span>"));
  assert.ok(globalsCss.includes("family-timetable-add.css"));
  assert.ok(globalsCss.includes("family-rouny-templates.css"));
  assert.ok(addCss.includes(".familyTimetableSlot"));
  assert.ok(addCss.includes("pointer-events: none"));
  assert.ok(addCss.includes(".familyTimetableColorChips"));
  assert.ok(addCss.includes("font-size: 0"));
  assert.ok(addCss.includes(".familyTimetableCopyPills"));
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  assert.ok(calendarCss.includes(".familyRounyTimePickerRow {"));
  assert.ok(calendarCss.includes(".familyRounyWeekdayPickerButton"));
  assert.ok(calendarCss.includes(".familyCalendarDatePickerPill,"));
  assert.ok(calendarCss.includes(".familyCalendarTimePickerPill,"));
  assert.ok(calendarCss.includes(".familyRounySessionList {"));
  assert.ok(calendarCss.includes(".familyRounySessionRemove"));
});

test("family timetable exposes twelve fixed pastel color options", async () => {
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  assert.match(rounySource, /FAMILY_CALENDAR_COLOR_KEYS\.map/);
  assert.equal(FAMILY_TIMETABLE_COLOR_KEYS.length, 12);
  for (const color of FAMILY_TIMETABLE_COLOR_KEYS) {
    assert.ok(`${rounySource}\n${dataSource}`.includes(`"${color}"`), `${color} should be in the color preset list`);
    const className = `${color[0].toUpperCase()}${color.slice(1)}`;
    assert.match(addCss, new RegExp(`\\.familyTimetableEntry${className}`));
    assert.match(addCss, new RegExp(`\\.familyTimetableColorChip${className}`));
  }
  for (const label of FAMILY_TIMETABLE_COLOR_LABELS) {
    assert.ok(`${rounySource}\n${dataSource}`.includes(label), `${label} should remain as a Korean color label`);
  }
  assert.match(dataSource, /DEFAULT_FAMILY_CALENDAR_COLOR\s*=\s*"pink"/);
  assert.match(addCss, /\.familyTimetableColorChipActive/);
});

test("family Roun timetable uses template library plus date-based assignments", async () => {
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const routeSource = await readSource("../app/family/roun/page.js");
  const rounyCss = await readSource("../app/styles/family-rouny-templates.css");

  for (const value of [
    "kaosgdd.family.rounWeeklyPlans.v1",
    "kaosgdd.family.rounAssignments.v1",
    "FAMILY_LEGACY_RONI_TEMPLATE_STORAGE_KEY",
    "kaosgdd.family.roniTimetableTemplates.v1",
    "FAMILY_LEGACY_RONI_OVERRIDE_STORAGE_KEY",
    "kaosgdd.family.roniOverrides.v1",
    "override.sourceRounyId || override.sourceRoniId",
    "plans",
    "assignments",
    "loadFamilyRounState",
    "saveFamilyRounState",
    "updateFamilyRounPlanItems",
    "resolveFamilyRounPlanForDate",
    "normalizeFamilyRounAssignment",
  ]) {
    assert.ok(dataSource.includes(value), `${value} should exist in Roun timeline data source`);
  }

  assert.ok(!dataSource.includes("activeTemplateId"), "Roun should not use an active-star template model");
  assert.ok(routeSource.includes("FamilyRounyClient"), "/family/roun should render the Roun timetable editor");

  for (const value of [
    "로운이",
    "주간시간표",
    "로운이 시간표",
    "새로 만들기",
    "새 시간표",
    "시간표 제목",
    "시간표 이름을 입력해주세요.",
    "열기",
    "적용하기",
    "적용 이력",
    "몇년 몇월 몇일부터 적용할까요?",
    "← 목록",
    "다른이름으로 저장",
    "저장",
    "수정",
    "복사",
    "삭제",
    "삭제할까요?",
    "마지막 시간표는 삭제할 수 없습니다.",
    "아직 시간표가 없습니다.",
    "적용 이력이 없습니다.",
  ]) {
    assert.ok(rounySource.includes(value), `${value} should exist in Roun template UI`);
  }

  assert.ok(rounySource.includes('type="date"'), "applying a Roun template should use a date picker");
  assert.ok(rounySource.includes("const [expandedPlanId, setExpandedPlanId] = useState(\"\");"), "template list rows should expand independently from editor state");
  assert.ok(rounySource.includes("const [planTitleDraft, setPlanTitleDraft] = useState(\"\");"), "opened editor should keep an editable title draft");
  assert.ok(rounySource.includes("resolveFamilyRounPlanForDate(todayDateKey(), rounState)?.id || \"\""), "current applied template should be derived from assignment resolution");
  assert.ok(rounySource.includes("const appliedPlanId = useMemo("), "current applied template should not be stored as a manual active flag");
  assert.ok(rounySource.includes("!openedPlan ? ("), "main Roun page should render the template list before opening a template");
  assert.ok(rounySource.includes("className=\"familyRounyTemplateToggle\""), "template rows should be compact clickable toggles");
  assert.ok(rounySource.includes("aria-expanded={expanded}"), "expanded template rows should expose expanded state");
  assert.ok(rounySource.includes("appliedPlanId === plan.id ? <span className=\"familyRounyAppliedStar\""), "currently applied row should show a text star");
  assert.ok(rounySource.includes("aria-label=\"현재 적용 중\""), "current applied star should be accessible");
  assert.ok(rounySource.includes("onClick={() => openPlan(plan.id)}>열기</button>"), "expanded rows should open the full editor");
  assert.ok(rounySource.includes("onClick={startNewPlan}"), "new template button should create and open a template");
  assert.ok(rounySource.includes("const nextPlan = createFamilyRounPlan(\"새 시간표\", []);"), "new templates should start blank with the default title");
  assert.ok(rounySource.includes("setOpenedPlanId(nextPlan.id);"), "new templates should open immediately in editor mode");
  assert.ok(rounySource.includes("function closePlanEditor()"), "editor should provide a way back to the list");
  assert.ok(rounySource.includes("copyPlan(openedPlan)"), "editor save-as should duplicate the current template");
  assert.ok(rounySource.includes("assignments: [...rounState.assignments, nextAssignment]"), "repeated template assignments should be appended as timeline entries");
  assert.ok(rounySource.includes("deleteAssignment"), "assignment deletion should be available");
  assert.ok(rounySource.includes("rounState.assignments.filter((assignment) => assignment.id !== assignmentId)"), "deleting an assignment should not delete a template");
  assert.ok(rounySource.includes("{openedPlan ? (\n            <section className=\"familyRounyPanel\" aria-label=\"적용 이력\">"), "assignment history should not render on the main template list");
  assert.ok(rounySource.includes("const assignmentLogRows = useMemo("), "assignment history should render as compact log rows");
  assert.ok(rounySource.includes("getRounAssignmentEndDate(sortedAssignments[index + 1]?.startDate)"), "assignment log should derive bounded end dates from the next assignment");
  assert.ok(rounySource.includes("formatFamilyDateKey(addFamilyDays(parsedDate, -1))"), "derived assignment end date should use the day before the next start date");
  assert.ok(rounySource.includes("`${assignment.startDateText} 부터 적용.`"), "open-ended assignment should render as a single log sentence");
  assert.ok(rounySource.includes("`${assignment.startDateText} 부터 ${assignment.endDateText} 까지 적용.`"), "bounded assignment should render as a single log sentence");
  assert.ok(rounySource.includes("className=\"familyRounyAssignmentLogLine\""), "assignment entries should use log-line markup");
  assert.ok(rounySource.includes("rounState.plans.length <= 1"), "last timetable deletion should be blocked");
  assert.ok(rounyCss.includes(".familyRounyTemplateActions"));
  assert.ok(rounyCss.includes("flex-wrap: wrap"));
  assert.ok(rounyCss.includes(".familyRounyTemplateList"));
  assert.ok(rounyCss.includes(".familyRounyTemplateToggle"));
  assert.ok(rounyCss.includes(".familyRounyAppliedStar"));
  assert.match(rounyCss, /\.familyRounyAppliedStar\s*\{[\s\S]*?display:\s*inline;[\s\S]*?color:\s*#d86f98;/);
  assert.doesNotMatch(rounyCss.match(/\.familyRounyAppliedStar\s*\{[\s\S]*?\}/)?.[0] || "", /background|border-radius|box-shadow/);
  assert.ok(rounyCss.includes(".familyRounyAssignmentLog"));
  assert.ok(rounyCss.includes(".familyRounyAssignmentLogLine"));
  assert.match(rounyCss, /\.familyRounyAssignmentLogLine\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;/);
  assert.match(rounyCss, /\.familyRounyAssignmentLogLine button\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.ok(rounyCss.includes(".familyRounEditorHeader"));
  assert.ok(rounyCss.includes(".familyRounPlanTitleField input"));
  assert.ok(rounyCss.includes(".familyRounEditorHeaderActions"));
  assert.ok(rounyCss.includes(".familyRounyTemplateRow strong"));
  assert.ok(rounyCss.includes("overflow-wrap: anywhere"));

  for (const preservedField of ["color", "fontFamily", "memo", "startTime", "endTime", "dayOfWeek"]) {
    assert.ok(dataSource.includes(preservedField), `${preservedField} should be preserved in template entries`);
  }
  assert.ok(rounySource.includes("+ 시간표"), "+ 시간표 should remain the Roun add-entry action");
  assert.ok(!rounySource.includes("+ 일정"), "+ 일정 should not be used inside the Roun timetable editor");

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자", "로니", "로우니"]) {
    assert.ok(!rounySource.includes(oldString), `${oldString} should not appear in Roun template UI`);
  }
});

test("family Roun weekly grid editor supports add edit copy delete and drag", async () => {
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const rounyCss = await readSource("../app/styles/family-rouny-templates.css");
  const dragSource = await readSource("../app/family/calendar/familyCalendarDrag.js");

  for (const value of [
    "ROUN_TIMETABLE_START_HOUR = 8",
    "ROUN_TIMETABLE_END_HOUR = 22",
    "ROUN_TIMETABLE_LABEL_HOURS = ROUN_TIMETABLE_HOURS.slice(1, -1)",
    "ROUN_TIMETABLE_SLOT_MINUTES = 10",
    "ROUN_TIMETABLE_DEFAULT_DURATION_MINUTES = 40",
    "snapRounMinutes",
    "slotMinutesFromPoint",
    "clickEmptySlot",
    "startEditRouny",
    "copyRouny",
    "deleteRouny",
    "startBlockDrag",
    "moveBlockDrag",
    "finishBlockDrag",
    "updateBlockTime",
    "formatRounDragReadout",
    "rounDragTargetRange",
  ]) {
    assert.ok(rounySource.includes(value), `${value} should exist for the Roun weekly editor`);
  }

  for (const value of [
    "FAMILY_SCHEDULE_DRAG_MOVE_LIMIT",
    "familyScheduleSlotMinutesFromPoint",
    "formatFamilyScheduleDragRangeLabel",
    "minutesToFamilyScheduleTime",
    "parseFamilyScheduleTimeMinutes",
    "snapFamilyScheduleMinutes",
    "beginFamilyScheduleDragSelectionLock",
    "endFamilyScheduleDragSelectionLock",
  ]) {
    assert.ok(rounySource.includes(value), `${value} should be reused from the shared Family schedule drag helpers`);
  }

  for (const value of [
    "FAMILY_SCHEDULE_DRAG_SLOT_MINUTES = 10",
    "FAMILY_SCHEDULE_DRAG_MOVE_LIMIT = 8",
    "formatFamilyScheduleDragTimeLabel",
    "formatFamilyScheduleDragRangeLabel",
    "familyScheduleSlotMinutesFromPoint",
    'FAMILY_SCHEDULE_DRAGGING_CLASS = "kaosDragging"',
    "function beginFamilyScheduleDragSelectionLock()",
    "function endFamilyScheduleDragSelectionLock()",
  ]) {
    assert.ok(dragSource.includes(value), `${value} should exist in the shared drag helper`);
  }

  for (const label of ["월", "화", "수", "목", "금", "토"]) {
    assert.ok(rounySource.includes(label) || rounySource.includes("FAMILY_CALENDAR_DAY_LABELS"), `${label} should be represented in the weekly editor`);
  }
  for (const value of ["수정", "복사", "삭제", "취소"]) {
    assert.ok(rounySource.includes(value), `${value} should appear in the block action sheet`);
  }

  assert.ok(rounyCss.includes(".familyRounWeeklyGrid"));
  assert.ok(rounyCss.includes("grid-template-columns: 30px repeat(6, minmax(0, 1fr));"));
  assert.ok(rounyCss.includes("overflow-y: visible;"));
  assert.ok(rounyCss.includes("overscroll-behavior: auto;"));
  assert.ok(rounyCss.includes("overflow-x: hidden;"));
  assert.ok(rounyCss.includes("grid-template-columns: 24px repeat(6, minmax(0, 1fr));"));
  assert.ok(rounyCss.includes(".familyRounHour span:nth-child(5) { top: 40px; }"));
  assert.ok(rounyCss.includes(".familyRounBlock"));
  assert.ok(rounyCss.includes("position: absolute;"));
  assert.ok(rounyCss.includes("touch-action: none;"));
  assert.match(rounyCss, /\.familyRounBlock\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?overflow:\s*hidden;[\s\S]*?text-align:\s*center;/);
  assert.match(rounyCss, /\.familyRounBlock span\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
  assert.ok(rounySource.includes('if (event.pointerType === "mouse" && event.button !== 0) return;'));
  assert.ok(rounySource.includes("event.currentTarget.setPointerCapture?.(event.pointerId);"));
  assert.ok(rounySource.includes("beginFamilyScheduleDragSelectionLock();"));
  assert.ok(rounySource.includes("endFamilyScheduleDragSelectionLock();"));
  assert.ok(rounySource.includes("function cancelBlockDrag(event)"));
  assert.ok(rounySource.includes("dragState.dragElement?.releasePointerCapture?.(event.pointerId);"));
  assert.ok(rounySource.includes("draggable={false}"));
  assert.ok(rounySource.includes("onDragStart={(event) => event.preventDefault()}"));
  assert.ok(rounySource.includes('className="familyCalendarDragGhost"'));
  assert.ok(rounySource.includes('className="familyCalendarDragReadout familyRounDragReadout"'));
  assert.ok(rounySource.includes('style={{ left: `${dragState.x}px`, top: `${dragState.y - 64}px` }}'));
  assert.ok(rounySource.includes("formatRounDragReadout(dragState.block, dragState.target)"));
  assert.ok(rounySource.includes("replaceItemSlot(item, block.slotIndex, slotValues)"), "dragging should update only the moved session");
  assert.ok(rounyCss.includes(".familyRounDragReadout {"));
  assert.ok(rounyCss.includes("white-space: pre-line;"));
});
