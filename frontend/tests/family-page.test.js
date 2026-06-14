import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family routes expose dashboard, memo, calendar, and Roni labels", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const memoPageSource = await readFile(new URL("../app/family/memo/page.js", import.meta.url), "utf8");
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(pageSource.includes("FamilyDashboardClient"));
  assert.ok(memoPageSource.includes("FamilyPageClient"));
  assert.ok(calendarPageSource.includes("FamilyCalendarClient"));
  assert.ok(timetablePageSource.includes("로니"));
  assert.ok(dashboardSource.includes("달력"));
  assert.ok(dashboardSource.includes("하그라"));
  assert.ok(dashboardSource.includes("/family/calendar"));
  assert.ok(!dashboardSource.includes('aria-label="뭔일"'));
  assert.ok(!dashboardSource.includes("뭔일이고"));
  assert.ok(globalsCss.includes("family-calendar.css"));
});

test("family calendar foundation keeps dated items and Roni separate", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  for (const value of [
    "kaosgdd.family.calendarItems.v1",
    "kaosgdd.family.defaultTimetable.v1",
    "getWeekStart(new Date())",
    "selectedWeekKey",
    "datedItemsByDate",
    "buildSelectedWeekItems",
    "groupItemsByHour",
    'type: "roni"',
    'type: "dated"',
    "familyCalendarItemRoni",
    "familyCalendarItemDated",
  ]) {
    assert.ok(calendarSource.includes(value));
  }
  for (const day of ["일", "월", "화", "수", "목", "금", "토"]) assert.ok(calendarSource.includes(day));
  assert.doesNotMatch(calendarSource, /dragstart|dragover|drop|draggable/);
  for (const cssValue of [".familyCalendarWeekHeader", ".familyCalendarWeekSelected", ".familyCalendarTimeRow", ".familyCalendarItemRoni", ".familyCalendarItemDated", "repeat(7, minmax(0, 1fr))", "overflow-x: hidden"]) {
    assert.ok(calendarCss.includes(cssValue));
  }
});

test("family quick pad and timetable smoke checks remain intact", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  for (const value of ["rows={checklistMode ? 4 : 1}", "requestAnimationFrame(resetInputHeight)", "", "function startEditMessage(message)", "function deleteMessage(messageId)"]) {
    assert.ok(clientSource.includes(value));
  }
  assert.ok(timetableSource.includes("kaosgdd.family.defaultTimetable.v1"));
  assert.ok(timetableSource.includes("TIMETABLE_SLOT_MINUTES = 10"));
  assert.doesNotMatch(timetableSource, /function addTimetableEntry|window\.prompt|draggable|dragstart|dragover|drop/);
  assert.ok(polishCss.includes("font-size: 22px"));
  assert.ok(polishCss.includes(".familyTaskDateInput"));
});
