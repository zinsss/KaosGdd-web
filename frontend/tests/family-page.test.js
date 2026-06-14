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

  assert.match(pageSource, /FamilyDashboardClient/);
  assert.match(memoPageSource, /FamilyPageClient/);
  assert.match(calendarPageSource, /FamilyCalendarClient/);
  assert.match(timetablePageSource, /로니 - KaosGdd/);
  assert.match(timetablePageSource, /aria-label="로니"/);
  assert.match(headerSource, /우짜노우짤꼬/);
  assert.match(headerSource, /모하노/);
  assert.match(headerSource, /모라노/);
  assert.match(dashboardSource, /달력/);
  assert.match(dashboardSource, /로니/);
  assert.match(dashboardSource, /하그라/);
  assert.match(dashboardSource, /다했데이/);
  assert.match(dashboardSource, /\/family\/calendar/);
  assert.match(dashboardSource, /\/family\/tasks\/new/);
  assert.match(dashboardSource, /\/family\/tasks\/done/);
  assert.doesNotMatch(dashboardSource, /aria-label="뭔일"/);
  assert.doesNotMatch(dashboardSource, /href="\/family\/timetable"/);
  assert.doesNotMatch(dashboardSource, /뭔일이고/);
  assert.match(clientSource, /aria-label="모라노"/);
  assert.match(clientSource, /<h2>모라꼬\?<\/h2>/);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, /모라켔노|뭐라켔노/);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, />\s*대시보드\s*</);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, />\s*메모장\s*</);
  assert.doesNotMatch(clientSource, /FamilyTimetable|familyMode|기본 시간표/);
  assert.match(globalsCss, /family\.css/);
  assert.match(globalsCss, /family-tasks\.css/);
  assert.match(globalsCss, /family-calendar\.css/);
  assert.match(globalsCss, /family-polish\.css/);
  assert.match(familyCss, /GangwonEducationHyunokSam/);
  assert.match(polishCss, /\.familyHeader h1\s*\{[\s\S]*?color:\s*#d86f98;/);
  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*22px;/);
});

test("family calendar foundation keeps dated items and Roni separate", async () => {
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  assert.match(calendarPageSource, /metadata/);
  assert.match(calendarPageSource, /title:\s*"달력 - KaosGdd"/);
  assert.match(calendarSource, /FAMILY_CALENDAR_STORAGE_KEY = "kaosgdd\.family\.calendarItems\.v1"/);
  assert.match(calendarSource, /FAMILY_RONI_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
  assert.match(calendarSource, /FAMILY_CALENDAR_DAY_LABELS = \["일", "월", "화", "수", "목", "금", "토"\]/);
  assert.match(calendarSource, /getWeekStart\(new Date\(\)\)/);
  assert.match(calendarSource, /const \[selectedWeekKey, setSelectedWeekKey\]/);
  assert.match(calendarSource, /datedItemsByDate/);
  assert.match(calendarSource, /datedItems\.reduce\(\(counts, item\)/);
  assert.match(calendarSource, /buildSelectedWeekItems\(selectedWeekStart, datedItems, roniTemplates\)/);
  assert.match(calendarSource, /type: "roni"/);
  assert.match(calendarSource, /type: "dated"/);
  assert.match(calendarSource, /groupItemsByHour/);
  assert.match(calendarSource, /selectedWeekRows\.length/);
  assert.match(calendarSource, /familyCalendarItemRoni/);
  assert.match(calendarSource, /familyCalendarItemDated/);
  assert.doesNotMatch(calendarSource, /dragstart|dragover|drop|draggable/);
  assert.match(calendarCss, /\.familyCalendarWeekHeader[\s\S]*?grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(calendarCss, /\.familyCalendarTimeRow[\s\S]*?grid-template-columns:\s*24px repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(calendarCss, /\.familyCalendarWeekSelected/);
  assert.match(calendarCss, /\.familyCalendarItemRoni[\s\S]*?background:\s*transparent;/);
  assert.match(calendarCss, /\.familyCalendarItemDated/);
  assert.match(calendarCss, /overflow-x:\s*hidden;/);
});

test("family composer avoids iOS zoom and resets textarea height after send", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyInput\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(familyCss, /\.familyChecklistToggle,\s*\.familySend,\s*\.familyCancel\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(polishCss, /\.familyInput[\s\S]*?font-size:\s*18px;/);
  assert.match(clientSource, /const inputRef = useRef\(null\);/);
  assert.match(clientSource, /function resetInputHeight\(\)/);
  assert.match(clientSource, /function resizeInputToContent/);
  assert.match(clientSource, /rows=\{checklistMode \? 4 : 1\}/);
  assert.match(clientSource, /requestAnimationFrame\(resetInputHeight\)/);
  assert.match(clientSource, />\s*\s*<\/button>/);
});

test("family default timetable remains a local Roni template model", async () => {
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(timetablePageSource, /FamilyHeader/);
  assert.match(timetablePageSource, /FamilyTimetable/);
  assert.match(timetablePageSource, /로니/);
  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
  assert.match(timetableSource, /TIMETABLE_SLOT_MINUTES = 10/);
  for (const dayLabel of ["일", "월", "화", "수", "목", "금", "토"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }
  assert.match(timetableSource, /window\.localStorage\.getItem\(FAMILY_TIMETABLE_STORAGE_KEY\)/);
  assert.match(timetableSource, /window\.localStorage\.setItem\(FAMILY_TIMETABLE_STORAGE_KEY, JSON\.stringify\(entries\)\)/);
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.doesNotMatch(timetableSource, /draggable|dragstart|dragover|drop/);
  assert.match(familyCss, /\.familyTimetable\s*\{/);
  assert.match(familyCss, /\.familyTimetableGrid\s*\{/);
  assert.match(familyCss, /\.familyTimetableEditor\s*\{/);
});

test("family bubbles keep edit/delete behavior and themed scrollbars", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyInput::-webkit-scrollbar/);
  assert.match(familyCss, /\.familyStream::-webkit-scrollbar-thumb/);
  assert.match(familyCss, /background:\s*rgba\(214, 128, 157, 0\.58\);/);
  assert.doesNotMatch(baseCss, /familyInput|214, 128, 157|255, 248, 251/);
  assert.doesNotMatch(shellCss, /familyInput|214, 128, 157|255, 248, 251/);
  assert.match(clientSource, /familyBubbleFooter/);
  assert.match(clientSource, /familyBubbleDeleteIcon/);
  assert.match(clientSource, /familyBubbleEditIcon/);
  assert.match(clientSource, /function startEditMessage\(message\)/);
  assert.match(clientSource, /function deleteMessage\(messageId\)/);
  assert.match(clientSource, /window\.confirm\("삭제할까요\?"\)/);
  assert.match(clientSource, /checkedStateQueues\.get\(item\.text\)/);
});

test("family polish keeps larger mobile-safe type without form overflow", async () => {
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*22px;/);
  assert.match(polishCss, /\.familyHeader h1\s*\{[\s\S]*?font-size:\s*30px;/);
  assert.match(polishCss, /\.familyHomeNavLink\s*\{[\s\S]*?font-size:\s*17px;/);
  assert.match(polishCss, /\.familyTaskForm input,[\s\S]*?\.familyTaskForm textarea\s*\{[\s\S]*?max-width:\s*100%;/);
  assert.match(polishCss, /\.familyTaskDateInput[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(polishCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTaskFormGrid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
});
