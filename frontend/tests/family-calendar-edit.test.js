import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family calendar exposes dated event and Roni edit actions", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../app/family/calendar/familyCalendarData.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  for (const value of ["+ 뭔날", "로니 고치까", "/family/calendar/events/new", "/family/calendar/roni", "getDefaultSelectedWeekKeyForMonth(nextMonth)"]) {
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
});

test("family calendar 고치까 mode swaps compact week for full timetable", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarSource.includes('const FAMILY_CALENDAR_MODE_VIEW = "view"'));
  assert.ok(calendarSource.includes('const FAMILY_CALENDAR_MODE_EDIT = "edit"'));
  assert.ok(calendarSource.includes("useState(FAMILY_CALENDAR_MODE_VIEW)"));
  assert.ok(calendarSource.includes("setCalendarMode(FAMILY_CALENDAR_MODE_EDIT)"));
  assert.ok(calendarSource.includes("setCalendarMode(FAMILY_CALENDAR_MODE_VIEW)"));
  for (const value of ["고치까", "고치는 중", "되따", "고마하자", "길게 눌러 뭔날 추가"]) {
    assert.ok(calendarSource.includes(value));
  }
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
  assert.ok(calendarSource.includes("className=\"familyCalendarLongPressTarget\""));
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

test("family calendar edit mode moves 뭔날 items without enabling Roni drag", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarSource.includes("saveFamilyCalendarItems"));
  assert.ok(calendarSource.includes("function eventDurationMinutes(item)"));
  assert.ok(calendarSource.includes("return FAMILY_CALENDAR_DEFAULT_EVENT_DURATION_MINUTES"));
  assert.ok(calendarSource.includes("function startDatedDrag(event, item)"));
  assert.ok(calendarSource.includes('const editableDatedItem = editItem && item.type === "dated"'));
  assert.ok(calendarSource.includes("if (editableDatedItem && onStartDatedDrag) onStartDatedDrag(event, item);"));
  assert.ok(calendarSource.includes("function findDropTarget(clientX, clientY)"));
  assert.ok(calendarSource.includes('dropElement.dataset.familyCalendarDrop === "date"'));
  assert.ok(calendarSource.includes("slotTimeFromPoint(clientY, dropElement.getBoundingClientRect())"));
  assert.ok(calendarSource.includes("function moveDatedItem(itemId, target)"));
  assert.ok(calendarSource.includes('if (target.type === "date") return { ...item, date: target.date };'));
  assert.ok(calendarSource.includes("const duration = eventDurationMinutes(item);"));
  assert.ok(calendarSource.includes("startTime,"));
  assert.ok(calendarSource.includes("endTime,"));
  assert.ok(calendarSource.includes("saveFamilyCalendarItems(nextItems)"));
  assert.ok(calendarSource.includes('data-family-calendar-drop="date"'));
  assert.ok(calendarSource.includes('data-family-calendar-drop="time"'));
  assert.ok(calendarSource.includes("Math.floor(minutesFromStart / 10) * 10"));
  assert.ok(calendarSource.includes('const editableRoniItem = editItem && item.type === "roni"'));
  assert.doesNotMatch(calendarSource, /function startRoniDrag|moveRoni|saveFamilyRoniItems|override model/i);

  assert.ok(calendarSource.includes("const FAMILY_CALENDAR_AUTO_SCROLL_EDGE_PX = 48"));
  assert.ok(calendarSource.includes("function updateAutoScroll(clientY)"));
  assert.ok(calendarSource.includes("window.setInterval"));
  assert.ok(calendarSource.includes("function stopAutoScroll()"));
  assert.ok(calendarSource.includes("stopAutoScroll();"));

  assert.match(calendarCss, /\.familyCalendarEditItemDragging[\s\S]*?opacity:/);
  assert.match(calendarCss, /\.familyCalendarDragGhost[\s\S]*?position:\s*fixed;/);
  assert.match(calendarCss, /\.familyCalendarDropSlotTarget[\s\S]*?pointer-events:\s*none;/);
  assert.match(calendarCss, /\.familyCalendarDropTargetActive[\s\S]*?box-shadow:/);
});

test("family Roni override foundation stores and applies weekly exceptions", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const dataSource = await readFile(new URL("../app/family/calendar/familyCalendarData.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(dataSource.includes('export const FAMILY_RONI_OVERRIDE_STORAGE_KEY = "kaosgdd.family.roniOverrides.v1"'));
  for (const value of ["id", "sourceRoniId", "date", "startTime", "endTime", "title", "deleted"]) {
    assert.ok(dataSource.includes(value));
  }
  assert.ok(dataSource.includes("function normalizeFamilyRoniOverride"));
  assert.ok(dataSource.includes("function loadFamilyRoniOverrides"));
  assert.ok(dataSource.includes("function saveFamilyRoniOverrides"));

  assert.ok(calendarSource.includes("function applyRoniOverrides(generatedRoniItems, roniOverrides)"));
  assert.ok(calendarSource.includes("const weekGeneratedRoniItems = roniItems.flatMap"));
  assert.ok(calendarSource.includes("const weekRoniItems = applyRoniOverrides(weekGeneratedRoniItems, roniOverrides)"));
  assert.ok(calendarSource.includes("return [...weekRoniItems, ...weekDatedItems]"));
  assert.ok(calendarSource.includes("if (override.deleted) return []"));
  assert.ok(calendarSource.includes("overridden: true"));
  assert.ok(calendarSource.includes("loadFamilyRoniOverrides()"));
  assert.ok(calendarSource.includes("saveFamilyRoniOverrides(nextOverrides)"));
  assert.ok(calendarSource.includes("function createRoniOverride(roniItem)"));
  assert.ok(calendarSource.includes("sourceRoniId: roniItem.sourceId"));
  assert.ok(calendarSource.includes("setRoniOverrides"));

  for (const value of ["로니 예외", "이번 주만 바꾸기", "로니도 바꾸기", "고마하자"]) {
    assert.ok(calendarSource.includes(value));
  }
  assert.ok(calendarSource.includes("function startRoniChoice(event, item)"));
  assert.ok(calendarSource.includes("setRoniChoiceItem(item)"));
  assert.ok(calendarSource.includes("onStartRoniChoice={startRoniChoice}"));
  assert.match(calendarSource, /router\.push\(["']\/family\/calendar\/roni["']\)/);
  assert.ok(calendarSource.includes("familyCalendarRoniOverrideBadge"));
  assert.ok(calendarSource.includes("예외"));
  assert.match(calendarCss, /\.familyCalendarRoniChoiceSheet[\s\S]*?display:\s*grid;/);
  assert.match(calendarCss, /\.familyCalendarRoniOverrideBadge[\s\S]*?font-size:\s*9px;/);
});

test("family dated event add and edit routes exist with Korean form labels", async () => {
  const newPageSource = await readFile(new URL("../app/family/calendar/events/new/page.js", import.meta.url), "utf8");
  const editPageSource = await readFile(new URL("../app/family/calendar/events/[id]/edit/page.js", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../app/family/calendar/events/FamilyCalendarEventFormClient.js", import.meta.url), "utf8");

  assert.ok(newPageSource.includes("FamilyCalendarEventFormClient"));
  assert.ok(editPageSource.includes("eventId={id}"));
  for (const value of [
    "모할꼬",
    "언제고",
    "시작",
    "끝",
    "머라? 좀 더 지끼봐라",
    "되따",
    "고마하자",
    "치아라",
    "loadFamilyCalendarItems",
    "saveFamilyCalendarItems",
    "normalizeFamilyCalendarItem",
    "router.push(\"/family/calendar\")",
    "current.filter((item) => item.id !== eventId)",
  ]) {
    assert.ok(formSource.includes(value));
  }
});

test("family Roni page lists and edits weekly template items", async () => {
  const pageSource = await readFile(new URL("../app/family/calendar/roni/page.js", import.meta.url), "utf8");
  const roniSource = await readFile(new URL("../app/family/calendar/roni/FamilyRoniClient.js", import.meta.url), "utf8");

  assert.ok(pageSource.includes("FamilyRoniClient"));
  for (const value of [
    "로니",
    "+ 로니",
    "고치까",
    "치아라",
    "모할꼬",
    "무슨요일",
    "시작",
    "끝",
    "머라? 좀 더 지끼봐라",
    "되따",
    "고마하자",
    "loadFamilyRoniItems",
    "saveFamilyRoniItems",
    "normalizeFamilyRoniItem",
    "current.filter((item) => item.id !== itemId)",
  ]) {
    assert.ok(roniSource.includes(value));
  }
  for (const weekday of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(roniSource.includes(weekday) || roniSource.includes("FAMILY_CALENDAR_WEEKDAY_OPTIONS"));
  }
});

test("family calendar add edit foundation keeps visible wording clean", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const eventFormSource = await readFile(new URL("../app/family/calendar/events/FamilyCalendarEventFormClient.js", import.meta.url), "utf8");
  const roniSource = await readFile(new URL("../app/family/calendar/roni/FamilyRoniClient.js", import.meta.url), "utf8");

  for (const source of [calendarSource, eventFormSource, roniSource]) {
    assert.ok(!source.includes("뭔일"));
  }
});
