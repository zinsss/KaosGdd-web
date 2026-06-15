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
  "우야노 우야꼬",
  "모하꼬?",
  "뭐라꼬?",
];

test("family shared header uses standard tab wording and unchanged routes", async () => {
  const headerSource = await readFile(new URL("../app/family/FamilyHeader.js", import.meta.url), "utf8");
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");

  assert.ok(headerSource.includes("가족"));
  for (const label of ["메모장", "달력", "할 일"]) assert.ok(headerSource.includes(label));
  for (const route of ["/family/memo", "/family/calendar", "/family"]) assert.ok(headerSource.includes(route));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!headerSource.includes(oldString));
  assert.ok(calendarPageSource.includes('FamilyHeader active="calendar"'));
});

test("family memo page uses standard title and checklist glyph", async () => {
  const memoSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.ok(memoSource.includes('aria-label="메모장"'));
  assert.ok(memoSource.includes("<h2>메모장</h2>"));
  assert.ok(memoSource.includes(""));
  assert.ok(memoSource.includes("저장"));
  assert.ok(memoSource.includes("취소"));
  assert.ok(!familyCss.includes("Hyunok"));
  assert.ok(!familyCss.includes("현옥"));
  assert.ok(!familyCss.includes("GangwonEducationHyunokSam"));
  assert.ok(familyCss.includes('font-family: "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;'));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!memoSource.includes(oldString));
});

test("family dashboard links to calendar and task sections with standard labels", async () => {
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const calendarPageSource = await readFile(new URL("../app/family/calendar/page.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.ok(dashboardSource.includes("달력"));
  assert.ok(dashboardSource.includes("할 일"));
  assert.ok(dashboardSource.includes("로우니 시간표"));
  assert.ok(dashboardSource.includes("/family/calendar"));
  assert.ok(calendarPageSource.includes("FamilyCalendarClient"));
  assert.ok(globalsCss.includes("family-calendar.css"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!dashboardSource.includes(oldString));
});

test("family calendar source keeps schedule and Roni foundation separate", async () => {
  const calendarSource = await readFile(new URL("../app/family/calendar/FamilyCalendarClient.js", import.meta.url), "utf8");
  const calendarDataSource = await readFile(new URL("../app/family/calendar/familyCalendarData.js", import.meta.url), "utf8");
  const calendarCss = await readFile(new URL("../app/styles/family-calendar.css", import.meta.url), "utf8");

  for (const value of ["kaosgdd.family.calendarItems.v1", "kaosgdd.family.defaultTimetable.v1", "FAMILY_CALENDAR_DAY_LABELS", "normalizeFamilyCalendarItem", "normalizeFamilyRoniItem"]) {
    assert.ok(calendarDataSource.includes(value));
  }
  for (const value of ["selectedWeekKey", "datedItemsByDate", "buildSelectedWeekItems", 'type: "roni"', 'type: "dated"', "loadFamilyCalendarItems", "loadFamilyRoniItems"]) {
    assert.ok(calendarSource.includes(value));
  }
  for (const label of ["로우니 시간표", "일정", "+ 일정", "수정", "저장", "취소"]) assert.ok(calendarSource.includes(label));
  for (const day of ["일", "월", "화", "수", "목", "금", "토"]) assert.ok(calendarDataSource.includes(day));
  assert.ok(calendarCss.includes("repeat(7, minmax(0, 1fr))"));
  assert.ok(calendarCss.includes(".familyCalendarItemRoni"));
  assert.ok(calendarCss.includes(".familyCalendarItemDated"));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!calendarSource.includes(oldString));
});
