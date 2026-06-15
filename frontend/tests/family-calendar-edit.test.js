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
  "다시 보이기",
  "뭔날",
  "뭔일",
  "로니 고치까",
];

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar exposes standard event and Roni wording", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  for (const label of ["달력", "+ 일정", "로우니 시간표 수정", "수정", "수정 중", "저장", "취소"]) {
    assert.ok(calendarSource.includes(label));
  }
  for (const value of ["kaosgdd.family.calendarItems.v1", "kaosgdd.family.defaultTimetable.v1", "kaosgdd.family.roniOverrides.v1"]) {
    assert.ok(dataSource.includes(value));
  }
  assert.ok(calendarCss.includes(".familyCalendarItemRoni"));
  assert.ok(calendarCss.includes(".familyCalendarItemDated"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!calendarSource.includes(oldString));
});

test("family calendar edit mode keeps full timetable surface and long press add foundation", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");

  for (const value of [
    'const FAMILY_CALENDAR_MODE_VIEW = "view"',
    'const FAMILY_CALENDAR_MODE_EDIT = "edit"',
    "setCalendarMode(FAMILY_CALENDAR_MODE_EDIT)",
    "const FAMILY_CALENDAR_EDIT_START_HOUR = 8",
    "const FAMILY_CALENDAR_EDIT_END_HOUR = 22",
    "const FAMILY_CALENDAR_LONG_PRESS_MS = 600",
    "function slotTimeFromPointer(event)",
    "router.push(`/family/calendar/events/new?date=",
    "길게 눌러 일정 추가",
  ]) assert.ok(calendarSource.includes(value));

  assert.ok(eventFormSource.includes("eventPrefillFromLocation"));
  assert.ok(eventFormSource.includes('params.get("date")'));
  assert.ok(eventFormSource.includes('params.get("start")'));
  assert.ok(eventFormSource.includes('params.get("end")'));
  assert.ok(calendarCss.includes(".familyCalendarEditGrid"));
  assert.ok(calendarCss.includes("repeat(7, minmax(0, 1fr))"));
});

test("family calendar Roni choice sheet uses finalized wording", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");

  for (const label of [
    "일정 옵션",
    "이번 주만 변경",
    "이번 주만 일정 취소",
    "로우니 기본 시간표도 변경",
    "취소",
    "되돌리기",
  ]) assert.ok(calendarSource.includes(label));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!calendarSource.includes(oldString));
});

test("family Roni overrides can hide and restore this week only", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  for (const value of [
    "function normalizeFamilyRoniOverride",
    "function loadFamilyRoniOverrides",
    "function saveFamilyRoniOverrides",
    "sourceRoniId",
    "deleted",
  ]) assert.ok(dataSource.includes(value));
  for (const value of [
    "function applyRoniOverrides",
    "if (exactOverride.deleted) return []",
    "function deleteRoniThisWeek(roniItem)",
    "deleted: true",
    "function restoreRoniOverride(overrideId)",
    "saveFamilyRoniOverrides(nextOverrides)",
    "familyCalendarRoniRestoreButton",
  ]) assert.ok(calendarSource.includes(value));
  assert.ok(calendarCss.includes(".familyCalendarRoniRestoreButton"));
});

test("family dated event form uses finalized schedule labels", async () => {
  const newPageSource = await readSource("../app/family/calendar/events/new/page.js");
  const editPageSource = await readSource("../app/family/calendar/events/[id]/edit/page.js");
  const formSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");

  assert.ok(newPageSource.includes("FamilyCalendarEventFormClient"));
  assert.ok(editPageSource.includes("eventId={id}"));
  for (const label of ["일정 추가", "일정 수정", "일정 이름", "날짜", "시작", "끝", "메모", "저장", "취소", "삭제", "일정 이름을 입력해주세요."]) {
    assert.ok(formSource.includes(label));
  }
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!formSource.includes(oldString));
});

test("family Roni page uses finalized template labels", async () => {
  const pageSource = await readSource("../app/family/calendar/roni/page.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");

  assert.ok(pageSource.includes("FamilyRoniClient"));
  for (const label of ["로우니 시간표", "+ 일정", "수정", "삭제", "일정 이름", "요일", "시작", "끝", "메모", "저장", "취소"]) {
    assert.ok(roniSource.includes(label));
  }
  for (const weekday of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(roniSource.includes(weekday) || roniSource.includes("FAMILY_CALENDAR_WEEKDAY_OPTIONS"));
  }
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!roniSource.includes(oldString));
});
