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
  assert.ok(calendarSource.includes("roniItems.flatMap"));
  assert.ok(dataSource.includes("kaosgdd.family.calendarItems.v1"));
  assert.ok(dataSource.includes("kaosgdd.family.defaultTimetable.v1"));
  assert.ok(dataSource.includes("function getDefaultSelectedWeekKeyForMonth"));
  assert.ok(dataSource.includes("today.getFullYear() === monthDate.getFullYear()"));
  assert.ok(calendarCss.includes(".familyCalendarActionLink"));
  assert.ok(calendarCss.includes(".familyCalendarForm"));
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
