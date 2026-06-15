import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const OLD_FAMILY_STRINGS = [
  "고치까",
  "치아라",
  "다했데이",
  "도로묵이다",
  "고마하자",
  "이번 주만 치아라",
  "로니도 바꾸기",
];

test("family calendar exposes standard event and Roni edit actions", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../app/family/calendar/familyCalendarData.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  for (const value of ["+ 일정", "로우니 시간표 수정", "/family/calendar/events/new", "/family/calendar/roni", "getDefaultSelectedWeekKeyForMonth(nextMonth)"]) {
    assert.ok(calendarSource.includes(value));
  }
  assert.ok(calendarSource.includes('item.type === "roni" ? "/family/calendar/roni" : `/family/calendar/events/${item.id}/edit`'));
  assert.ok(calendarSource.includes("datedItemsByDate"));
  assert.ok(calendarSource.includes("loadFamilyRoniOverrides"));
  assert.ok(dataSource.includes("kaosgdd.family.calendarItems.v1"));
  assert.ok(dataSource.includes("kaosgdd.family.defaultTimetable.v1"));
  assert.ok(dataSource.includes("kaosgdd.family.roniOverrides.v1"));
  assert.ok(dataSource.includes("function getDefaultSelectedWeekKeyForMonth"));
  assert.ok(dataSource.includes("today.getFullYear() === monthDate.getFullYear()"));
  assert.ok(calendarCss.includes(".familyCalendarActionLink"));
  assert.ok(calendarCss.includes(".familyCalendarForm"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!calendarSource.includes(oldString));
});

test("family calendar edit mode swaps compact week for full timetable", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarSource.includes('const FAMILY_CALENDAR_MODE_VIEW = "view"'));
  assert.ok(calendarSource.includes('const FAMILY_CALENDAR_MODE_EDIT = "edit"'));
  assert.ok(calendarSource.includes("useState(FAMILY_CALENDAR_MODE_VIEW)"));
  assert.ok(calendarSource.includes("setCalendarMode(FAMILY_CALENDAR_MODE_EDIT)"));
  assert.ok(calendarSource.includes("setCalendarMode(FAMILY_CALENDAR_MODE_VIEW)"));
  for (const value of ["수정", "수정 중", "저장", "취소", "길게 눌러 일정 추가"]) assert.ok(calendarSource.includes(value));
  assert.ok(calendarSource.includes("editingCalendar ?"));
  assert.ok(calendarSource.includes("<FamilyCalendarEditWeek"));
  assert.ok(calendarSource.includes("familyCalendarExpandedWeek"));
  assert.ok(calendarSource.includes("selectedWeekRows.map"));
  assert.ok(calendarSource.includes("const FAMILY_CALENDAR_EDIT_START_HOUR = 8"));
  assert.ok(calendarSource.includes("const FAMILY_CALENDAR_EDIT_END_HOUR = 22"));
  assert.ok(calendarSource.includes("FAMILY_CALENDAR_EDIT_VISIBLE_HOURS"));
  assert.ok(calendarSource.includes("formatEditHourLabel(hour)"));
  assert.doesNotMatch(calendarSource, /draggable|onDrag/);

  assert.match(calendarCss, /\.familyCalendarEditWeek[\s\S]*?overflow-y:\s*auto;/);
  assert.match(calendarCss, /\.familyCalendarEditGrid[\s\S]*?grid-template-columns:\s*42px repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(calendarCss, /\.familyCalendarEditGrid[\s\S]*?overflow-x:\s*hidden;/);
  assert.match(calendarCss, /\.familyCalendarEditHour span:nth-child\(5\)[\s\S]*?top:\s*50px;/);
  assert.match(calendarCss, /@media \(max-width:\s*640px\)[\s\S]*?\.familyCalendarEditGrid[\s\S]*?grid-template-columns:\s*28px repeat\(7, minmax\(0, 1fr\)\);/);
});

test("family calendar edit mode long press opens new event with slot prefill", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const eventFormSource = await readFile(new URL("../app/family/calendar/events/FamilyCalendarEventFormClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarSource.includes("const FAMILY_CALENDAR_LONG_PRESS_MS = 600"));
  assert.ok(calendarSource.includes("const FAMILY_CALENDAR_LONG_PRESS_MOVE_LIMIT = 10"));
  assert.ok(calendarSource.includes("const FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES = 40"));
  assert.ok(calendarSource.includes("function slotTimeFromPointer(event)"));
  assert.ok(calendarSource.includes("Math.floor(minutesFromStart / 10) * 10"));
  assert.ok(calendarSource.includes("formatFamilyDateKey(addFamilyDays(selectedWeekStart, dayIndex))"));
  assert.ok(calendarSource.includes("start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}"));
  assert.ok(calendarSource.includes("window.setTimeout"));
  assert.ok(calendarSource.includes("FAMILY_CALENDAR_LONG_PRESS_MS"));
  assert.ok(calendarSource.includes("onPointerDown={(event) => startSlotLongPress(event, dayIndex)}"));
  assert.ok(calendarSource.includes("onPointerMove={moveSlotLongPress}"));
  assert.ok(calendarSource.includes("onPointerUp={clearPendingLongPress}"));
  assert.ok(calendarSource.includes("onPointerCancel={clearPendingLongPress}"));
  assert.ok(calendarSource.includes("event.stopPropagation()"));
  assert.ok(calendarSource.includes('className="familyCalendarLongPressTarget"'));
  assert.ok(calendarSource.includes("editingCalendar ?"));
  assert.doesNotMatch(calendarSource, /onClick=\{\(event\) => startSlotLongPress/);
  assert.doesNotMatch(calendarSource, /onClick=\{\(\) => openNewEventForSlot/);

  assert.ok(eventFormSource.includes("eventPrefillFromLocation"));
  assert.ok(eventFormSource.includes("new URLSearchParams(window.location.search)"));
  assert.ok(eventFormSource.includes('params.get("date")'));
  assert.ok(eventFormSource.includes('params.get("start")'));
  assert.ok(eventFormSource.includes('params.get("end")'));
  assert.ok(eventFormSource.includes("FAMILY_CALENDAR_EVENT_DEFAULT_DURATION_MINUTES = 40"));
  assert.ok(eventFormSource.includes("addMinutesToTime(startTime, FAMILY_CALENDAR_EVENT_DEFAULT_DURATION_MINUTES)"));
  assert.ok(eventFormSource.includes("setDraft((current) => ({ ...current, ...eventPrefillFromLocation() }))"));

  assert.match(calendarCss, /\.familyCalendarEditDayColumn[\s\S]*?touch-action:\s*pan-y;/);
  assert.match(calendarCss, /\.familyCalendarLongPressTarget[\s\S]*?pointer-events:\s*none;/);
});

test("family calendar edit mode moves dated and Roni items through the correct save paths", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  for (const value of [
    "saveFamilyCalendarItems",
    "saveFamilyRoniItems",
    "function eventDurationMinutes(item)",
    "return FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES",
    "function movedItemValues(item, target)",
    "function startDatedDrag(event, item)",
    "function startRoniDrag(event, item)",
    "function startCalendarItemDrag(event, item)",
    'const editableDatedItem = editItem && item.type === "dated"',
    'const editableRoniItem = editItem && item.type === "roni"',
    "if (editableDatedItem && onStartDatedDrag) onStartDatedDrag(event, item);",
    "if (editableRoniItem && onStartRoniDrag) onStartRoniDrag(event, item);",
    "function findDropTarget(clientX, clientY)",
    'dropElement.dataset.familyCalendarDrop === "date"',
    "slotTimeFromPoint(clientY, dropElement.getBoundingClientRect())",
    "function moveDatedItem(itemId, target)",
    "function moveRoniTemplate(roniItem, target)",
    'if (pending.itemType === "roni")',
    "setPendingRoniMove({ item: pending.item, target: currentDragState.target })",
    "onCreateRoniOverride(pendingRoniMove.item, pendingRoniMove.target)",
    "onMoveRoniTemplate(pendingRoniMove.item, pendingRoniMove.target)",
    "saveFamilyCalendarItems(nextItems)",
    "saveFamilyRoniItems(nextItems)",
    'data-family-calendar-drop="date"',
    'data-family-calendar-drop="time"',
    "Math.floor(minutesFromStart / 10) * 10",
    "const FAMILY_CALENDAR_AUTO_SCROLL_EDGE_PX = 48",
    "function updateAutoScroll(clientY)",
    "window.setInterval",
    "function stopAutoScroll()",
  ]) assert.ok(calendarSource.includes(value));

  assert.match(calendarCss, /\.familyCalendarEditItemDragging[\s\S]*?opacity:/);
  assert.match(calendarCss, /\.familyCalendarDragGhost[\s\S]*?position:\s*fixed;/);
  assert.match(calendarCss, /\.familyCalendarDropSlotTarget[\s\S]*?pointer-events:\s*none;/);
  assert.match(calendarCss, /\.familyCalendarDropTargetActive[\s\S]*?box-shadow:/);
});

test("family Roni override foundation stores and applies weekly exceptions", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../app/family/calendar/familyCalendarData.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(dataSource.includes("kaosgdd.family.roniOverrides.v1"));
  assert.ok(dataSource.includes("function normalizeFamilyRoniOverride"));
  assert.ok(dataSource.includes("function loadFamilyRoniOverrides"));
  assert.ok(dataSource.includes("function saveFamilyRoniOverrides"));
  for (const field of ["sourceRoniId", "date", "startTime", "endTime", "title", "deleted"]) assert.ok(dataSource.includes(field));

  for (const value of [
    "function applyRoniOverrides",
    "const weekGeneratedRoniItems = roniItems.flatMap",
    "applyRoniOverrides(weekGeneratedRoniItems, roniOverrides",
    "if (exactOverride.deleted) return []",
    "overridden: true",
    "loadFamilyRoniOverrides()",
    "saveFamilyRoniOverrides(nextOverrides)",
    "function createRoniOverride",
    "setRoniOverrides",
    "sourceRoniId: `${item.id}:${slotIndex}`",
    "roniOverrideKey(override.sourceRoniId, override.date) !== roniOverrideKey(sourceRoniId, values.date)",
    "일정 옵션",
    "이번 주만 변경",
    "이번 주만 일정 취소",
    "로우니 기본 시간표도 변경",
    "취소",
    "되돌리기",
    "familyCalendarRoniOverrideBadge",
    "familyCalendarRoniChoiceSheet",
  ]) assert.ok(calendarSource.includes(value) || calendarCss.includes(value));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!calendarSource.includes(oldString));
});

test("family Roni can be hidden and restored for only this week", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarSource.includes("이번 주만 일정 취소"));
  assert.ok(calendarSource.includes("function chooseDeleteThisWeek()"));
  assert.ok(calendarSource.includes("function deleteRoniThisWeek(roniItem)"));
  assert.ok(calendarSource.includes("deleted: true"));
  assert.ok(calendarSource.includes("onDeleteRoniThisWeek={deleteRoniThisWeek}"));
  assert.ok(calendarSource.includes("groupDeletedRoniOverridesByDate"));
  assert.ok(calendarSource.includes("deletedRoniOverridesByDate"));
  assert.ok(calendarSource.includes("familyCalendarRoniRestoreButton"));
  assert.ok(calendarSource.includes("되돌리기"));
  assert.ok(calendarSource.includes("function restoreRoniOverride(overrideId)"));
  assert.ok(calendarSource.includes("current.filter((override) => override.id !== overrideId)"));
  assert.ok(calendarSource.includes("saveFamilyRoniOverrides(nextOverrides)"));
  assert.ok(calendarSource.includes("onRestoreRoniOverride={restoreRoniOverride}"));
  assert.ok(calendarSource.includes("saveFamilyRoniItems(nextItems)"));
  assert.ok(calendarSource.indexOf("function deleteRoniThisWeek") < calendarSource.indexOf("function moveRoniTemplate"));
  assert.match(calendarCss, /\.familyCalendarRoniRestoreStack[\s\S]*?position:\s*absolute;/);
  assert.match(calendarCss, /\.familyCalendarRoniRestoreButton[\s\S]*?border:\s*0;/);
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!calendarSource.includes(oldString));
});

test("family dated event add and edit routes exist with standard form labels", async () => {
  const newPageSource = await readFile(new URL("../app/family/calendar/events/new/page.js", import.meta.url), "utf8");
  const editPageSource = await readFile(new URL("../app/family/calendar/events/[id]/edit/page.js", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../app/family/calendar/events/FamilyCalendarEventFormClient.js", import.meta.url), "utf8");

  assert.ok(newPageSource.includes("FamilyCalendarEventFormClient"));
  assert.ok(editPageSource.includes("eventId={id}"));
  for (const value of [
    "일정 추가",
    "일정 수정",
    "일정 이름",
    "날짜",
    "시작",
    "끝",
    "메모",
    "저장",
    "취소",
    "삭제",
    "일정 이름을 입력해주세요.",
    "loadFamilyCalendarItems",
    "saveFamilyCalendarItems",
    "normalizeFamilyCalendarItem",
    "router.push(\"/family/calendar\")",
    "current.filter((item) => item.id !== eventId)",
  ]) assert.ok(formSource.includes(value));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!formSource.includes(oldString));
});

test("family Roni page lists and edits weekly template items with standard labels", async () => {
  const pageSource = await readFile(new URL("../app/family/calendar/roni/page.js", import.meta.url), "utf8");
  const roniSource = await readFile(new URL("../app/family/calendar/roni/FamilyRoniClient.js", import.meta.url), "utf8");

  assert.ok(pageSource.includes("FamilyRoniClient"));
  for (const value of [
    "로우니 시간표",
    "+ 일정",
    "수정",
    "삭제",
    "일정 이름",
    "요일",
    "시작",
    "끝",
    "메모",
    "저장",
    "취소",
    "loadFamilyRoniItems",
    "saveFamilyRoniItems",
    "normalizeFamilyRoniItem",
    "current.filter((item) => item.id !== itemId)",
  ]) assert.ok(roniSource.includes(value));
  for (const weekday of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(roniSource.includes(weekday) || roniSource.includes("FAMILY_CALENDAR_WEEKDAY_OPTIONS"));
  }
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!roniSource.includes(oldString));
});

test("family calendar add edit foundation keeps removed wording out of visible sources", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const eventFormSource = await readFile(new URL("../app/family/calendar/events/FamilyCalendarEventFormClient.js", import.meta.url), "utf8");
  const roniSource = await readFile(new URL("../app/family/calendar/roni/FamilyRoniClient.js", import.meta.url), "utf8");

  for (const source of [calendarSource, eventFormSource, roniSource]) {
    for (const oldString of [...OLD_FAMILY_STRINGS, "뭔날", "뭔일", "로니 고치까"]) assert.ok(!source.includes(oldString));
  }
});
