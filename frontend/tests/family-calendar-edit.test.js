import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar uses finalized standard Korean wording", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const polishCss = await readSource("../app/styles/family-polish.css");
  const combinedSource = `${calendarSource}\n${eventFormSource}\n${roniSource}`;

  for (const label of [
    "달력",
    "+ 일정",
    "로운이 시간표",
    "일정 옵션",
    "이번 주만 변경",
    "이번 주만 일정 취소",
    "로운이 시간표 변경",
    "되돌리기",
    "일정 이름",
    "시작",
    "끝",
    "메모",
    "저장",
    "취소",
    "삭제",
    "일정 이름을 입력해주세요.",
  ]) {
    assert.ok(combinedSource.includes(label), `${label} should appear in Family calendar sources`);
  }

  for (const value of [
    "kaosgdd.family.calendarItems.v1",
    "kaosgdd.family.defaultTimetable.v1",
    "kaosgdd.family.rounWeeklyPlans.v1",
    "kaosgdd.family.rounAssignments.v1",
    "kaosgdd.family.roniOverrides.v1",
  ]) {
    assert.ok(dataSource.includes(value));
  }
  assert.ok(dataSource.includes("resolveFamilyRounPlanForDate"));
  assert.ok(calendarSource.includes("resolveFamilyRounPlanForDate"));
  assert.ok(calendarCss.includes(".familyCalendarItemRoni"));
  assert.ok(calendarCss.includes(".familyCalendarItemDated"));
  assert.ok(polishCss.includes(".familyCalendarItemRoni.familyTimetableEntryPink"));
  assert.ok(polishCss.includes(".familyCalendarItemDated"));

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자", "이번 주만 치아라", "로니도 바꾸기", "다시 보이기"]) {
    assert.ok(!combinedSource.includes(oldString), `${oldString} should not remain in Family calendar UI`);
  }
});

test("family calendar mobile header uses compact two-row actions", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  for (const label of ["+ 일정", "로운이 시간표 수정", "수정"]) {
    assert.ok(calendarSource.includes(label), `${label} should remain in calendar header actions`);
  }
  assert.ok(calendarSource.includes("changeMonth(-1)"));
  assert.ok(calendarSource.includes("changeMonth(1)"));


  assert.match(calendarCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarIntro\s*\{[\s\S]*?display:\s*grid;/);

  assert.match(calendarCss, /\.familyCalendarActions\s*\{[\s\S]*?grid-template-areas:\s*\n\s*"prev month next"\s*\n\s*"add roni edit";/);

  assert.match(calendarCss, /\.familyCalendarActions\s*\{[\s\S]*?gap:\s*6px;/);

  assert.match(calendarCss, /\.familyCalendarActions button,\s*\n\s*\.familyCalendarActionLink\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?min-height:\s*32px;[\s\S]*?white-space:\s*nowrap;/);

  assert.match(calendarCss, /@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.familyCalendarIntro\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자"]) {
    assert.ok(!calendarSource.includes(oldString), `${oldString} should not return in calendar source`);
  }
});

test("family calendar week rows share a global time rail", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.ok(calendarSource.includes('className="familyCalendarExpandedWeek"'));
  assert.ok(calendarSource.includes('<i className="familyCalendarTimeRailSpacer" aria-hidden="true" />'));
  assert.ok(calendarSource.includes("familyCalendarWeekDay"));
  assert.ok(calendarSource.includes('className="familyCalendarTimeRow"'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeLabel"'));
  assert.ok(calendarSource.includes('className="familyCalendarDaySlot"'));
  assert.ok(
    calendarSource.indexOf('className="familyCalendarTimeLabel"') <
      calendarSource.indexOf('className="familyCalendarDaySlot"'),
    "time label should render before day slots, not inside a day cell",
  );

  const spacerCount = calendarSource.match(/familyCalendarTimeRailSpacer/g)?.length || 0;
  assert.ok(spacerCount >= 3, "header, date rows, and count rows should all render rail spacers");

  assert.match(
    calendarCss,
    /\.familyCalendarWeekHeader,\s*\n\.familyCalendarTimeRow,\s*\n\.familyCalendarWeekDates,\s*\n\.familyCalendarWeekCounts\s*\{[\s\S]*?grid-template-columns:\s*34px repeat\(7, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    calendarCss,
    /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarWeekHeader,\s*\n\s*\.familyCalendarTimeRow,\s*\n\s*\.familyCalendarWeekDates,\s*\n\s*\.familyCalendarWeekCounts\s*\{[\s\S]*?grid-template-columns:\s*28px repeat\(7, minmax\(0, 1fr\)\);/,
  );
  assert.match(calendarCss, /\.familyCalendarExpandedWeek\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(calendarCss, /\.familyCalendarTimeLabel\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(calendarCss, /\.familyCalendarDaySlot\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.match(calendarCss, /\.familyCalendarDaySlot\s*>\s*\*\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(calendarCss, /\.familyCalendarTimeRailSpacer\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(calendarCss, /\.familyCalendarTimeRailSpacer\s*\{[\s\S]*?background:\s*rgba\(255, 248, 251, 0\.72\);[\s\S]*?box-shadow:\s*inset -1px 0 rgba\(214, 128, 157, 0\.14\);/);
  assert.match(calendarCss, /\.familyCalendarTimeLabel\s*\{[\s\S]*?background:\s*rgba\(255, 248, 251, 0\.72\);[\s\S]*?box-shadow:\s*inset -1px 0 rgba\(214, 128, 157, 0\.14\);/);
  assert.match(calendarCss, /\.familyCalendarWeek::before,\s*\n\.familyCalendarWeek::after\s*\{[\s\S]*?top:\s*var\(--family-calendar-week-pad\);[\s\S]*?bottom:\s*var\(--family-calendar-week-pad\);[\s\S]*?width:\s*var\(--family-calendar-day-width\);/);
  assert.match(calendarCss, /\.familyCalendarWeek::before\s*\{[\s\S]*?left:\s*calc\(var\(--family-calendar-week-pad\) \+ var\(--family-calendar-rail-width\) \+ var\(--family-calendar-week-gap\)\);[\s\S]*?background:\s*rgba\(255, 216, 229, 0\.28\);/);
  assert.match(calendarCss, /\.familyCalendarWeek::after\s*\{[\s\S]*?\* 6\)\);[\s\S]*?background:\s*rgba\(219, 234, 254, 0\.34\);/);
  assert.match(calendarCss, /\.familyCalendarWeekDates \.familyCalendarWeekDay:first-of-type,\s*\n\.familyCalendarWeekCounts span:first-of-type,\s*\n\.familyCalendarWeekHeader span:first-of-type/);
  assert.doesNotMatch(calendarCss, /\.familyCalendarWeekDates span:first-child/);
  assert.match(calendarCss, /\.familyCalendarWeekDay\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;/);
  assert.match(
    calendarCss,
    /\.familyCalendarDaySlot\s+\.familyCalendarItem\s*>\s*span:first-child\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/,
  );
});
