import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family routes expose dashboard, memo, calendar, and Roni labels", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const memoPageSource = await readFile(new URL("../app/family/memo/page.js", import.meta.url), "utf8");
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const headerSource = await readFile(new URL("../app/family/FamilyHeader.js", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(pageSource.includes("FamilyDashboardClient"));
  assert.ok(memoPageSource.includes("FamilyPageClient"));
  assert.ok(calendarPageSource.includes("FamilyCalendarClient"));
  assert.ok(timetablePageSource.includes("로니 - KaosGdd"));
  for (const text of ["우짜노우짤꼬", "모하노", "모라노"]) assert.ok(headerSource.includes(text));
  for (const text of ["달력", "로니", "하그라", "/family/calendar", "/family/tasks/new", "/family/tasks/done"]) {
    assert.ok(dashboardSource.includes(text));
  }
  assert.ok(!dashboardSource.includes('aria-label="뭔일"'));
  assert.ok(!dashboardSource.includes('href="/family/timetable"'));
  assert.ok(!dashboardSource.includes("뭔일이고"));
  assert.ok(clientSource.includes('aria-label="모라노"'));
  assert.ok(clientSource.includes("<h2>모라꼬?</h2>"));
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, /모라켔노|뭐라켔노|>\s*대시보드\s*<|>\s*메모장\s*</);
  for (const cssImport of ["family.css", "family-tasks.css", "family-calendar.css", "family-polish.css"]) assert.ok(globalsCss.includes(cssImport));
});

test("family calendar foundation keeps dated items and Roni separate", async () => {
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarPageSource.includes("달력 - KaosGdd"));
  assert.ok(calendarSource.includes("kaosgdd.family.calendarItems.v1"));
  assert.ok(calendarSource.includes("kaosgdd.family.defaultTimetable.v1"));
  for (const day of ["일", "월", "화", "수", "목", "금", "토"]) assert.ok(calendarSource.includes(day));
  for (const value of ["getWeekStart(new Date())", "selectedWeekKey", "datedItemsByDate", "buildSelectedWeekItems", "groupItemsByHour"]) {
    assert.ok(calendarSource.includes(value));
  }
  assert.ok(calendarSource.includes('type: "roni"'));
  assert.ok(calendarSource.includes('type: "dated"'));
  assert.ok(calendarSource.includes("familyCalendarItemRoni"));
  assert.ok(calendarSource.includes("familyCalendarItemDated"));
  assert.doesNotMatch(calendarSource, /dragstart|dragover|drop|draggable/);
  for (const cssValue of [".familyCalendarWeekHeader", ".familyCalendarWeekSelected", ".familyCalendarTimeRow", ".familyCalendarItemRoni", ".familyCalendarItemDated", "repeat(7, minmax(0, 1fr))", "overflow-x: hidden"]) {
    assert.ok(calendarCss.includes(cssValue));
  }
});

test("family composer and bubble behavior stays intact", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  for (const value of ["const inputRef = useRef(null);", "function resetInputHeight()", "function resizeInputToContent", "rows={checklistMode ? 4 : 1}", "requestAnimationFrame(resetInputHeight)", "", "familyBubbleFooter", "familyBubbleDeleteIcon", "familyBubbleEditIcon", "function startEditMessage(message)", "function deleteMessage(messageId)"]) {
    assert.ok(clientSource.includes(value));
  }
  assert.ok(familyCss.includes(".familyInput"));
  assert.ok(familyCss.includes("font-size: 16px"));
  assert.ok(familyCss.includes(".familyInput::-webkit-scrollbar"));
  assert.ok(familyCss.includes("rgba(214, 128, 157, 0.58)"));
  assert.ok(polishCss.includes("font-size: 22px"));
});

test("family default timetable remains a local Roni template model", async () => {
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.ok(timetablePageSource.includes("로니"));
  assert.ok(timetableSource.includes("kaosgdd.family.defaultTimetable.v1"));
  assert.ok(timetableSource.includes("TIMETABLE_SLOT_MINUTES = 10"));
  for (const dayLabel of ["일", "월", "화", "수", "목", "금", "토"]) assert.ok(timetableSource.includes(`label: "${dayLabel}"`));
  assert.ok(timetableSource.includes("window.localStorage.getItem(FAMILY_TIMETABLE_STORAGE_KEY)"));
  assert.ok(timetableSource.includes("window.localStorage.setItem(FAMILY_TIMETABLE_STORAGE_KEY, JSON.stringify(entries))"));
  assert.doesNotMatch(timetableSource, /function addTimetableEntry|window\.prompt|draggable|dragstart|dragover|drop/);
});

test("family polish keeps larger mobile-safe type without form overflow", async () => {
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  for (const value of [".familyPage", "font-size: 22px", ".familyHeader h1", "font-size: 30px", ".familyTaskDateInput", "box-sizing: border-box", ".familyTaskFormGrid", "grid-template-columns: minmax(0, 1fr)"]) {
    assert.ok(polishCss.includes(value));
  }
});
