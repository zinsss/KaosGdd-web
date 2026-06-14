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
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.ok(pageSource.includes("FamilyDashboardClient"));
  assert.ok(memoPageSource.includes("FamilyPageClient"));
  assert.ok(calendarPageSource.includes("FamilyCalendarClient"));
  assert.ok(timetablePageSource.includes("로니 - KaosGdd"));
  assert.ok(timetablePageSource.includes('aria-label="로니"'));
  for (const text of ["우짜노우짤꼬", "모하노", "모라노"]) assert.ok(headerSource.includes(text));
  for (const text of ["달력", "로니", "하그라", "다했데이", "/family/calendar", "/family/tasks/new", "/family/tasks/done"]) {
    assert.ok(dashboardSource.includes(text));
  }
  assert.ok(!dashboardSource.includes('aria-label="뭔일"'));
  assert.ok(!dashboardSource.includes('href="/family/timetable"'));
  assert.ok(!dashboardSource.includes("뭔일이고"));
  assert.ok(clientSource.includes('aria-label="모라노"'));
  assert.ok(clientSource.includes("<h2>모라꼬?</h2>"));
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, /모라켔노|뭐라켔노/);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, />\s*대시보드\s*</);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, />\s*메모장\s*</);
  assert.ok(!clientSource.includes("FamilyTimetable"));
  assert.ok(!clientSource.includes("familyMode"));
  assert.ok(!clientSource.includes("기본 시간표"));
  for (const cssImport of ["family.css", "family-tasks.css", "family-calendar.css", "family-polish.css"]) assert.ok(globalsCss.includes(cssImport));
  assert.ok(familyCss.includes("GangwonEducationHyunokSam"));
  assert.ok(polishCss.includes(".familyHeader h1"));
  assert.ok(polishCss.includes("color: #d86f98"));
  assert.ok(polishCss.includes("font-size: 22px"));
});

test("family calendar foundation keeps dated items and Roni separate", async () => {
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.ok(calendarPageSource.includes("달력 - KaosGdd"));
  assert.ok(calendarSource.includes('FAMILY_CALENDAR_STORAGE_KEY = "kaosgdd.family.calendarItems.v1"'));
  assert.ok(calendarSource.includes('FAMILY_RONI_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1"'));
  assert.ok(calendarSource.includes('FAMILY_CALENDAR_DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]'));
  assert.ok(calendarSource.includes("getWeekStart(new Date())"));
  assert.ok(calendarSource.includes("selectedWeekKey"));
  assert.ok(calendarSource.includes("datedItemsByDate"));
  assert.ok(calendarSource.includes("datedItems.reduce((counts, item)"));
  assert.ok(calendarSource.includes("buildSelectedWeekItems(selectedWeekStart, datedItems, roniTemplates)"));
  assert.ok(calendarSource.includes('type: "roni"'));
  assert.ok(calendarSource.includes('type: "dated"'));
  assert.ok(calendarSource.includes("groupItemsByHour"));
  assert.ok(calendarSource.includes("selectedWeekRows.length"));
  assert.ok(calendarSource.includes("familyCalendarItemRoni"));
  assert.ok(calendarSource.includes("familyCalendarItemDated"));
  assert.doesNotMatch(calendarSource, /dragstart|dragover|drop|draggable/);
  for (const cssValue of [
    ".familyCalendarWeekHeader",
    ".familyCalendarWeekSelected",
    ".familyCalendarTimeRow",
    ".familyCalendarItemRoni",
    ".familyCalendarItemDated",
    "grid-template-columns: repeat(7, minmax(0, 1fr))",
    "grid-template-columns: 24px repeat(7, minmax(0, 1fr))",
    "background: transparent",
    "overflow-x: hidden",
  ]) {
    assert.ok(calendarCss.includes(cssValue));
  }
});

test("family composer avoids iOS zoom and resets textarea height after send", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.ok(familyCss.includes(".familyInput"));
  assert.ok(familyCss.includes("font-size: 16px"));
  assert.ok(polishCss.includes(".familyInput"));
  assert.ok(polishCss.includes("font-size: 18px"));
  assert.ok(clientSource.includes("const inputRef = useRef(null);"));
  assert.ok(clientSource.includes("function resetInputHeight()"));
  assert.ok(clientSource.includes("function resizeInputToContent"));
  assert.ok(clientSource.includes("rows={checklistMode ? 4 : 1}"));
  assert.ok(clientSource.includes("requestAnimationFrame(resetInputHeight)"));
  assert.ok(clientSource.includes(""));
});

test("family default timetable remains a local Roni template model", async () => {
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.ok(timetablePageSource.includes("FamilyHeader"));
  assert.ok(timetablePageSource.includes("FamilyTimetable"));
  assert.ok(timetablePageSource.includes("로니"));
  assert.ok(timetableSource.includes('FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd.family.defaultTimetable.v1"'));
  assert.ok(timetableSource.includes("TIMETABLE_SLOT_MINUTES = 10"));
  for (const dayLabel of ["일", "월", "화", "수", "목", "금", "토"]) {
    assert.ok(timetableSource.includes(`label: "${dayLabel}"`));
  }
  assert.ok(timetableSource.includes("window.localStorage.getItem(FAMILY_TIMETABLE_STORAGE_KEY)"));
  assert.ok(timetableSource.includes("window.localStorage.setItem(FAMILY_TIMETABLE_STORAGE_KEY, JSON.stringify(entries))"));
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.doesNotMatch(timetableSource, /draggable|dragstart|dragover|drop/);
  for (const selector of [".familyTimetable", ".familyTimetableGrid", ".familyTimetableEditor"]) assert.ok(familyCss.includes(selector));
});

test("family bubbles keep edit/delete behavior and themed scrollbars", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.ok(familyCss.includes(".familyInput::-webkit-scrollbar"));
  assert.ok(familyCss.includes(".familyStream::-webkit-scrollbar-thumb"));
  assert.ok(familyCss.includes("rgba(214, 128, 157, 0.58)"));
  assert.doesNotMatch(baseCss, /familyInput|214, 128, 157|255, 248, 251/);
  assert.doesNotMatch(shellCss, /familyInput|214, 128, 157|255, 248, 251/);
  for (const value of ["familyBubbleFooter", "familyBubbleDeleteIcon", "familyBubbleEditIcon", "function startEditMessage(message)", "function deleteMessage(messageId)", "checkedStateQueues.get(item.text)"]) {
    assert.ok(clientSource.includes(value));
  }
  assert.ok(clientSource.includes('window.confirm("삭제할까요?")'));
});

test("family polish keeps larger mobile-safe type without form overflow", async () => {
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  for (const value of [
    ".familyPage",
    "font-size: 22px",
    ".familyHeader h1",
    "font-size: 30px",
    ".familyHomeNavLink",
    "font-size: 17px",
    "max-width: 100%",
    ".familyTaskDateInput",
    "box-sizing: border-box",
    ".familyTaskFormGrid",
    "grid-template-columns: minmax(0, 1fr)",
  ]) {
    assert.ok(polishCss.includes(value));
  }
});
