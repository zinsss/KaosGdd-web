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

test("family calendar uses one shared 8-column gutter grid with quiet time rail", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const baseCalendarCss = await readSource("../app/styles/family-calendar.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");
  const globalsCss = await readSource("../app/globals.css");
  const combinedCss = `${baseCalendarCss}\n${compactCss}`;

  assert.ok(globalsCss.includes('@import "./styles/family-calendar-compact-month.css";'));
  assert.ok(calendarSource.includes('className="familyCalendarExpandedWeek"'));
  assert.ok(calendarSource.includes('<i className="familyCalendarTimeRailSpacer" aria-hidden="true" />'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeRow"'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeLabel"'));
  assert.ok(calendarSource.includes('className="familyCalendarDaySlot"'));
  assert.ok(
    calendarSource.indexOf('className="familyCalendarTimeLabel"') <
      calendarSource.indexOf('className="familyCalendarDaySlot"'),
    "time label should render before day slots, not inside a day cell",
  );

  assert.match(
    compactCss,
    /\.familyCalendarWeekHeader,\s*\n\.familyCalendarWeekDates,\s*\n\.familyCalendarWeekCounts,\s*\n\.familyCalendarTimeRow\s*\{[\s\S]*?--family-calendar-expanded-rail-width:\s*34px;[\s\S]*?grid-template-columns:\s*var\(--family-calendar-expanded-rail-width,\s*34px\) repeat\(7,\s*minmax\(0,\s*1fr\)\);[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?padding:\s*0;/,
  );
  assert.match(
    compactCss,
    /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarWeekHeader,\s*\n\s*\.familyCalendarWeekDates,\s*\n\s*\.familyCalendarWeekCounts,\s*\n\s*\.familyCalendarTimeRow\s*\{[\s\S]*?--family-calendar-expanded-rail-width:\s*28px;[\s\S]*?grid-template-columns:\s*var\(--family-calendar-expanded-rail-width,\s*28px\) repeat\(7,\s*minmax\(0,\s*1fr\)\);/,
  );
  assert.match(compactCss, /\.familyCalendarTimeRailSpacer\s*\{[\s\S]*?display:\s*block;[\s\S]*?pointer-events:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekDates \.familyCalendarTimeRailSpacer::before\s*\{[\s\S]*?content:\s*"";[\s\S]*?border-top:\s*5px solid transparent;[\s\S]*?border-bottom:\s*5px solid transparent;[\s\S]*?border-left:\s*7px solid rgba\(92,\s*50,\s*68,\s*0\.42\);/);
  assert.match(compactCss, /\.familyCalendarWeekSelected \.familyCalendarWeekDates \.familyCalendarTimeRailSpacer::before\s*\{[\s\S]*?border-top:\s*7px solid rgba\(92,\s*50,\s*68,\s*0\.42\);[\s\S]*?border-right:\s*5px solid transparent;[\s\S]*?border-bottom:\s*0;[\s\S]*?border-left:\s*5px solid transparent;/);
  assert.doesNotMatch(compactCss, /Symbols Nerd Font||/);
  assert.match(compactCss, /\.familyCalendarWeekHeader span,\s*\n\.familyCalendarWeekDay,\s*\n\.familyCalendarWeekCounts span\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?padding:\s*0;[\s\S]*?text-align:\s*center;/);
  assert.doesNotMatch(compactCss, /\.familyCalendarWeekHeader span[\s\S]*?text-align:\s*(left|right);/);
  assert.doesNotMatch(compactCss, /\.familyCalendarWeekDay[\s\S]*?text-align:\s*(left|right);/);
  assert.doesNotMatch(compactCss, /\.familyCalendarWeekCounts span[\s\S]*?text-align:\s*(left|right);/);
  assert.doesNotMatch(compactCss, /\.familyCalendarWeekHeader span[\s\S]*?padding-(left|right):/);
  assert.doesNotMatch(compactCss, /\.familyCalendarWeekDay[\s\S]*?padding-(left|right):/);
  assert.doesNotMatch(compactCss, /\.familyCalendarWeekCounts span[\s\S]*?padding-(left|right):/);
  assert.match(compactCss, /\.familyCalendarWeekHeader \.familyCalendarTimeRailSpacer,\s*\n\.familyCalendarWeekCounts \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(compactCss, /\.familyCalendarExpandedWeek::before,\s*\n\.familyCalendarExpandedWeek::after\s*\{[\s\S]*?width:\s*var\(--family-calendar-expanded-day-width\);/);
  assert.match(compactCss, /\.familyCalendarExpandedWeek::before\s*\{[\s\S]*?left:\s*calc\(var\(--family-calendar-expanded-rail-width\) \+ var\(--family-calendar-expanded-gap\)\);/);
  assert.match(compactCss, /\.familyCalendarExpandedWeek::after\s*\{[\s\S]*?\* 6\)\);/);
  assert.match(compactCss, /\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(92, 50, 68, 0\.38\);[\s\S]*?font-size:\s*0\.72rem;[\s\S]*?font-weight:\s*600;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(92, 50, 68, 0\.32\);[\s\S]*?font-size:\s*0\.66rem;/);
  assert.match(compactCss, /\.familyCalendarTimeLabel::after\s*\{[\s\S]*?rgba\(214, 128, 157, 0\.1\)/);
  assert.match(compactCss, /\.familyCalendarWeekHeader span:first-of-type,[\s\S]*?color:\s*#d86f98;/);
  assert.match(compactCss, /\.familyCalendarWeekHeader span:last-of-type,[\s\S]*?color:\s*#4f8bcf;/);
  assert.match(combinedCss, /\.familyCalendarDaySlot\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.match(combinedCss, /\.familyCalendarDaySlot\s+\.familyCalendarItem\s*>\s*span:first-child\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
});
