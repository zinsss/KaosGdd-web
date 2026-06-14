import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family dashboard links to the calendar foundation", async () => {
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(dashboardSource.includes("달력"));
  assert.ok(dashboardSource.includes("하그라"));
  assert.ok(dashboardSource.includes("/family/calendar"));
  assert.ok(!dashboardSource.includes('aria-label="뭔일"'));
  assert.ok(!dashboardSource.includes("뭔일이고"));
  assert.ok(calendarPageSource.includes("FamilyCalendarClient"));
  assert.ok(globalsCss.includes("family-calendar.css"));
});

test("family calendar source keeps dated items and Roni foundation separate", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarDataSource = await readFile(new URL("../app/family/calendar/familyCalendarData.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  for (const value of ["kaosgdd.family.calendarItems.v1", "kaosgdd.family.defaultTimetable.v1", "FAMILY_CALENDAR_DAY_LABELS", "normalizeFamilyCalendarItem", "normalizeFamilyRoniItem"]) {
    assert.ok(calendarDataSource.includes(value));
  }
  for (const value of ["selectedWeekKey", "datedItemsByDate", "buildSelectedWeekItems", 'type: "roni"', 'type: "dated"', "loadFamilyCalendarItems", "loadFamilyRoniItems"]) {
    assert.ok(calendarSource.includes(value));
  }
  for (const day of ["일", "월", "화", "수", "목", "금", "토"]) assert.ok(calendarDataSource.includes(day));
  assert.ok(calendarCss.includes("repeat(7, minmax(0, 1fr))"));
  assert.ok(calendarCss.includes(".familyCalendarItemRoni"));
  assert.ok(calendarCss.includes(".familyCalendarItemDated"));
});
