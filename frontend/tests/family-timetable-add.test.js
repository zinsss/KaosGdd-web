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
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
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
    assert.ok(roniSource.includes(value), `${value} should remain in Roun timetable editor sources`);
  }

  const weekdaySources = `${roniSource}\n${dataSource}`;
  for (const day of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(weekdaySources.includes(day), `${day} should remain available to the Roun editor`);
  }
  for (const value of ["dayOfWeek", "startTime", "endTime", "sessions", "slots", "color", "fontFamily", "normalizeFamilyRoniItem"]) {
    assert.ok(roniSource.includes(value));
  }
  assert.ok(dataSource.includes("Array.isArray(item.sessions)"), "Roun item normalization should accept sessions arrays");
  assert.ok(dataSource.includes("sessions: slots"), "Roun item normalization should preserve normalized sessions");
  assert.ok(roniSource.includes("function roniSessions(item)"), "Roun editor should normalize legacy slots and sessions together");
  assert.ok(roniSource.includes("return roniSessions(item).flatMap((slot, slotIndex) => {"), "each session should render as an independent timetable block");
  assert.ok(roniSource.includes("...item,"), "each rendered session block should retain the parent item fields");
  assert.ok(roniSource.includes("setDraft(roniToDraft(block));"), "editing any session block should open the shared parent item draft");
  assert.ok(roniSource.includes('className="familyRoniTimePickerRow"'));
  assert.ok(roniSource.includes('className="familyRoniSessionList"'));
  assert.ok(roniSource.includes('className="familyRoniSessionListLabel">시간</span>'));
  assert.ok(roniSource.includes('className="familyTaskActionButton familyRoniSessionAdd"'));
  assert.ok(roniSource.includes("+ 요일/시간"));
  assert.ok(roniSource.includes("function addDraftSession()"));
  assert.ok(roniSource.includes("function removeDraftSession(sessionIndex)"));
  assert.ok(roniSource.includes("if (!current || (current.sessions || []).length <= 1) return current;"));
  assert.ok(roniSource.includes("function shortWeekdayLabel(dayOfWeek)"));
  assert.ok(roniSource.includes('className="familyCalendarPickerButton familyRoniWeekdayPickerButton"'));
  assert.ok(roniSource.includes('aria-label="로운이 일정 요일 선택"'));
  assert.ok(!roniSource.includes('<span className="familyCalendarDateTimeDivider" aria-hidden="true">,</span>'));
  assert.ok(!roniSource.includes('<span className="familyCalendarDateTimeDivider" aria-hidden="true">|</span>'));
  assert.equal((roniSource.match(/className="familyCalendarPickerButton familyRoniTimePickerButton"/g) || []).length, 2);
  assert.ok(roniSource.includes('aria-label="로운이 일정 시작 시간 선택"'));
  assert.ok(roniSource.includes('aria-label="로운이 일정 끝 시간 선택"'));
  assert.ok(!roniSource.includes('<input type="time" value={draft.startTime}'));
  assert.ok(!roniSource.includes('<input type="time" value={draft.endTime}'));
  assert.ok(!roniSource.includes('<select value={draft.dayOfWeek}'));
  assert.ok(!roniSource.includes("FAMILY_TIMETABLE_FONT_PRESETS"));
  assert.ok(!roniSource.includes("<span>글씨체</span>"));
  assert.ok(globalsCss.includes("family-timetable-add.css"));
  assert.ok(globalsCss.includes("family-roni-templates.css"));
  assert.ok(addCss.includes(".familyTimetableSlot"));
  assert.ok(addCss.includes("pointer-events: none"));
  assert.ok(addCss.includes(".familyTimetableColorChips"));
  assert.ok(addCss.includes("font-size: 0"));
  assert.ok(addCss.includes(".familyTimetableCopyPills"));
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  assert.ok(calendarCss.includes(".familyRoniTimePickerRow {"));
  assert.ok(calendarCss.includes(".familyRoniWeekdayPickerButton"));
  assert.ok(calendarCss.includes(".familyCalendarDatePickerPill,"));
  assert.ok(calendarCss.includes(".familyCalendarTimePickerPill,"));
  assert.ok(calendarCss.includes(".familyRoniSessionList {"));
  assert.ok(calendarCss.includes(".familyRoniSessionRemove"));
});

test("family timetable exposes twelve fixed pastel color options", async () => {
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  assert.match(roniSource, /FAMILY_CALENDAR_COLOR_KEYS\.map/);
  assert.equal(FAMILY_TIMETABLE_COLOR_KEYS.length, 12);
  for (const color of FAMILY_TIMETABLE_COLOR_KEYS) {
    assert.ok(`${roniSource}\n${dataSource}`.includes(`"${color}"`), `${color} should be in the color preset list`);
    const className = `${color[0].toUpperCase()}${color.slice(1)}`;
    assert.match(addCss, new RegExp(`\\.familyTimetableEntry${className}`));
    assert.match(addCss, new RegExp(`\\.familyTimetableColorChip${className}`));
  }
  for (const label of FAMILY_TIMETABLE_COLOR_LABELS) {
    assert.ok(`${roniSource}\n${dataSource}`.includes(label), `${label} should remain as a Korean color label`);
  }
  assert.match(dataSource, /DEFAULT_FAMILY_CALENDAR_COLOR\s*=\s*"pink"/);
  assert.match(addCss, /\.familyTimetableColorChipActive/);
});

test("family Roun timetable uses template library plus date-based assignments", async () => {
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const routeSource = await readSource("../app/family/roun/page.js");
  const roniCss = await readSource("../app/styles/family-roni-templates.css");

  for (const value of [
    "kaosgdd.family.rounWeeklyPlans.v1",
    "kaosgdd.family.rounAssignments.v1",
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
  assert.ok(routeSource.includes("FamilyRoniClient"), "/family/roun should render the Roun timetable editor");

  for (const value of [
    "로운이",
    "주간시간표",
    "시간표 저장",
    "새 시간표",
    "시간표 이름",
    "시간표 이름을 입력해주세요.",
    "적용하기",
    "적용 이력",
    "몇년 몇월 몇일부터 적용할까요?",
    "고치기",
    "복사",
    "삭제",
    "삭제할까요?",
    "마지막 시간표는 삭제할 수 없습니다.",
    "아직 시간표가 없습니다.",
    "적용 이력이 없습니다.",
  ]) {
    assert.ok(roniSource.includes(value), `${value} should exist in Roun template UI`);
  }

  assert.ok(roniSource.includes('type="date"'), "applying a Roun template should use a date picker");
  assert.ok(roniSource.includes("assignments: [...rounState.assignments, nextAssignment]"), "repeated template assignments should be appended as timeline entries");
  assert.ok(roniSource.includes("deleteAssignment"), "assignment deletion should be available");
  assert.ok(roniSource.includes("rounState.assignments.filter((assignment) => assignment.id !== assignmentId)"), "deleting an assignment should not delete a template");
  assert.ok(roniSource.includes("rounState.plans.length <= 1"), "last timetable deletion should be blocked");
  assert.ok(roniCss.includes(".familyRoniTemplateActions"));
  assert.ok(roniCss.includes("flex-wrap: wrap"));
  assert.ok(roniCss.includes(".familyRoniTemplateRow strong"));
  assert.ok(roniCss.includes("overflow-wrap: anywhere"));

  for (const preservedField of ["color", "fontFamily", "memo", "startTime", "endTime", "dayOfWeek"]) {
    assert.ok(dataSource.includes(preservedField), `${preservedField} should be preserved in template entries`);
  }
  assert.ok(roniSource.includes("+ 시간표"), "+ 시간표 should remain the Roun add-entry action");
  assert.ok(!roniSource.includes("+ 일정"), "+ 일정 should not be used inside the Roun timetable editor");

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자", "로니", "로우니"]) {
    assert.ok(!roniSource.includes(oldString), `${oldString} should not appear in Roun template UI`);
  }
});

test("family Roun weekly grid editor supports add edit copy delete and drag", async () => {
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const roniCss = await readSource("../app/styles/family-roni-templates.css");
  const dragSource = await readSource("../app/family/calendar/familyCalendarDrag.js");

  for (const value of [
    "ROUN_TIMETABLE_START_HOUR = 8",
    "ROUN_TIMETABLE_END_HOUR = 22",
    "ROUN_TIMETABLE_SLOT_MINUTES = 10",
    "ROUN_TIMETABLE_DEFAULT_DURATION_MINUTES = 40",
    "snapRounMinutes",
    "slotMinutesFromPoint",
    "clickEmptySlot",
    "startEditRoni",
    "copyRoni",
    "deleteRoni",
    "startBlockDrag",
    "moveBlockDrag",
    "finishBlockDrag",
    "updateBlockTime",
    "formatRounDragReadout",
    "rounDragTargetRange",
  ]) {
    assert.ok(roniSource.includes(value), `${value} should exist for the Roun weekly editor`);
  }

  for (const value of [
    "FAMILY_SCHEDULE_DRAG_MOVE_LIMIT",
    "familyScheduleSlotMinutesFromPoint",
    "formatFamilyScheduleDragRangeLabel",
    "minutesToFamilyScheduleTime",
    "parseFamilyScheduleTimeMinutes",
    "snapFamilyScheduleMinutes",
  ]) {
    assert.ok(roniSource.includes(value), `${value} should be reused from the shared Family schedule drag helpers`);
  }

  for (const value of [
    "FAMILY_SCHEDULE_DRAG_SLOT_MINUTES = 10",
    "FAMILY_SCHEDULE_DRAG_MOVE_LIMIT = 8",
    "formatFamilyScheduleDragTimeLabel",
    "formatFamilyScheduleDragRangeLabel",
    "familyScheduleSlotMinutesFromPoint",
  ]) {
    assert.ok(dragSource.includes(value), `${value} should exist in the shared drag helper`);
  }

  for (const label of ["일", "월", "화", "수", "목", "금", "토"]) {
    assert.ok(roniSource.includes(label) || roniSource.includes("FAMILY_CALENDAR_DAY_LABELS"), `${label} should be represented in the weekly editor`);
  }
  for (const value of ["고치기", "복사", "삭제", "취소"]) {
    assert.ok(roniSource.includes(value), `${value} should appear in the block action sheet`);
  }

  assert.ok(roniCss.includes(".familyRounWeeklyGrid"));
  assert.ok(roniCss.includes("grid-template-columns: 30px repeat(7, minmax(0, 1fr));"));
  assert.ok(roniCss.includes("overflow-y: auto;"));
  assert.ok(roniCss.includes("overflow-x: hidden;"));
  assert.ok(roniCss.includes("grid-template-columns: 24px repeat(7, minmax(0, 1fr));"));
  assert.ok(roniCss.includes(".familyRounHour span:nth-child(5) { top: 40px; }"));
  assert.ok(roniCss.includes(".familyRounBlock"));
  assert.ok(roniCss.includes("position: absolute;"));
  assert.ok(roniCss.includes("touch-action: none;"));
  assert.ok(roniSource.includes('if (event.pointerType === "mouse" && event.button !== 0) return;'));
  assert.ok(roniSource.includes("event.currentTarget.setPointerCapture?.(event.pointerId);"));
  assert.ok(roniSource.includes("dragState.dragElement?.releasePointerCapture?.(event.pointerId);"));
  assert.ok(roniSource.includes("draggable={false}"));
  assert.ok(roniSource.includes("onDragStart={(event) => event.preventDefault()}"));
  assert.ok(roniSource.includes('className="familyCalendarDragGhost"'));
  assert.ok(roniSource.includes('className="familyCalendarDragReadout familyRounDragReadout"'));
  assert.ok(roniSource.includes('style={{ left: `${dragState.x}px`, top: `${dragState.y - 64}px` }}'));
  assert.ok(roniSource.includes("formatRounDragReadout(dragState.block, dragState.target)"));
  assert.ok(roniSource.includes("replaceItemSlot(item, block.slotIndex, slotValues)"), "dragging should update only the moved session");
  assert.ok(roniCss.includes(".familyRounDragReadout {"));
  assert.ok(roniCss.includes("white-space: pre-line;"));
});
