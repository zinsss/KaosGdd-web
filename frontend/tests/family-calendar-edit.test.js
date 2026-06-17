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
    "종일 일정",
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

  for (const oldString of [
    "고치까",
    "치아라",
    "다했데이",
    "도로묵이다",
    "고마하자",
    "이번 주만 치아라",
    "로니도 바꾸기",
    "다시 보이기",
  ]) {
    assert.ok(!combinedSource.includes(oldString), `${oldString} should not remain in Family calendar UI`);
  }
});

test("family calendar header keeps a single ordered row with the edit toggle", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.ok(calendarSource.includes("편집 모드"));
  assert.ok(calendarSource.includes("changeMonth(-1)"));
  assert.ok(calendarSource.includes("changeMonth(1)"));
  assert.ok(calendarSource.includes('className="familyCalendarMonthControls"'));
  assert.ok(calendarSource.includes('className="familyCalendarEditToggle"'));
  assert.ok(calendarSource.includes('role="switch"'));
  assert.ok(calendarSource.includes('href="/family/calendar/events/new?allDay=1"'));
  assert.ok(!calendarSource.includes("일정과 로운이 시간표를 함께 봐요."));
  assert.ok(!calendarSource.includes("로운이 시간표 수정"));
  assert.ok(!calendarSource.includes("수정 중"));
  assert.ok(calendarSource.indexOf("<h2>달력</h2>") < calendarSource.indexOf('className="familyCalendarMonthControls"'));
  assert.ok(calendarSource.indexOf('className="familyCalendarMonthControls"') < calendarSource.indexOf("+ 일정"));
  assert.ok(calendarSource.indexOf("+ 일정") < calendarSource.indexOf("편집 모드"));

  assert.ok(calendarCss.includes(".familyCalendarIntro {"));
  assert.ok(calendarCss.includes("justify-content: space-between;"));
  assert.ok(calendarCss.includes("flex-wrap: nowrap;"));
  assert.ok(calendarCss.includes(".familyCalendarActions {"));
  assert.ok(calendarCss.includes("margin-left: auto;"));
  assert.ok(calendarCss.includes("justify-content: flex-end;"));
  assert.ok(calendarCss.includes(".familyCalendarMonthControls {"));
  assert.ok(calendarCss.includes("display: inline-flex;"));
  assert.ok(calendarCss.includes("@media (max-width: 640px)"));
  assert.ok(calendarCss.includes("@media (max-width: 420px)"));
  assert.ok(!calendarCss.includes("grid-template-areas"));
});

test("family calendar week gutter chevron can collapse and re-expand the selected week", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");

  assert.ok(calendarSource.includes("function toggleWeekSelection(weekKey)"));
  assert.ok(calendarSource.includes('setSelectedWeekKey((current) => (current === weekKey ? "" : weekKey));'));
  assert.ok(calendarSource.includes("const selected = Boolean(selectedWeekKey) && week.key === selectedWeekKey;"));
  assert.ok(calendarSource.includes('className="familyCalendarWeekToggle"'));
  assert.ok(calendarSource.includes("onClick={() => toggleWeekSelection(week.key)}"));
  assert.ok(calendarSource.includes('aria-label={selected ? "이번 주 접기" : "이번 주 펼치기"}'));
  assert.ok(calendarSource.includes("onClick={() => selectWeek(week.key)}"));
});

test("family calendar edit mode stays in the selected-week layout and only expands time rows", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.ok(calendarSource.includes('className="familyCalendarExpandedWeek familyCalendarExpandedWeekEditable"'));
  assert.ok(calendarSource.includes("buildEditWeekRows"));
  assert.ok(calendarSource.includes("data-slot-start-minutes={hourStartMinutes}"));
  assert.ok(calendarSource.includes('className="familyCalendarTimeRow familyCalendarTimeRowEditable"'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeLabel familyCalendarTimeLabelEditable"'));
  assert.ok(calendarSource.includes('className="familyCalendarDaySlot familyCalendarDaySlotEditable"'));
  assert.ok(calendarSource.includes('className="familyCalendarDaySlotGuides"'));
  assert.ok(!calendarSource.includes("길게 눌러 일정 추가"));

  assert.match(calendarCss, /\.familyCalendarExpandedWeekEditable\s*\{[\s\S]*?max-height:\s*min\(64vh,\s*760px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(calendarCss, /\.familyCalendarTimeRowEditable\s*\{[\s\S]*?align-items:\s*stretch;/);
  assert.match(calendarCss, /\.familyCalendarTimeLabelEditable\s*\{[\s\S]*?min-height:\s*60px;/);
  assert.match(calendarCss, /\.familyCalendarDaySlotEditable\s*\{[\s\S]*?position:\s*relative;[\s\S]*?min-height:\s*60px;[\s\S]*?overflow:\s*visible;/);
  assert.match(calendarCss, /\.familyCalendarDaySlotGuides span:nth-child\(5\)\s*\{[\s\S]*?top:\s*50px;/);
});

test("family calendar all-day marker defaults the form and renders a top all-day row", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.ok(eventFormSource.includes('params.get("allDay") === "1"'));
  assert.ok(eventFormSource.includes("allDay: item.allDay === true"));
  assert.ok(eventFormSource.includes("function toggleAllDay(nextAllDay)"));
  assert.ok(eventFormSource.includes("draft.allDay ? null : ("));
  assert.ok(eventFormSource.includes('placeholder="새 일정"'));

  assert.ok(dataSource.includes("const allDay = item.allDay === true;"));
  assert.ok(dataSource.includes("allDay,"));
  assert.ok(dataSource.includes("allDay: false,"));

  assert.ok(calendarSource.includes("function groupAllDayItems(items)"));
  assert.ok(calendarSource.includes("const selectedWeekAllDayItems = useMemo(() => groupAllDayItems(selectedWeekItems), [selectedWeekItems]);"));
  assert.ok(calendarSource.includes("selectedWeekItems.filter((item) => !item.allDay)"));
  assert.ok(calendarSource.includes('className="familyCalendarTimeRow familyCalendarAllDayRow"'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeLabel familyCalendarAllDayLabel"'));
  assert.ok(calendarSource.includes('className="familyCalendarDaySlot familyCalendarAllDaySlot"'));
  assert.ok(calendarSource.includes('className="familyCalendarAllDayItem"'));

  assert.ok(calendarCss.includes(".familyCalendarAllDayRow {"));
  assert.ok(calendarCss.includes(".familyCalendarAllDayLabel {"));
  assert.ok(calendarCss.includes(".familyCalendarAllDaySlot {"));
  assert.ok(calendarCss.includes(".familyCalendarAllDayItem {"));
  assert.ok(calendarCss.includes(".familyCalendarFormToggle {"));
  assert.ok(calendarCss.includes(".familyCalendarFormToggleControl {"));
  assert.ok(calendarCss.includes(".familyCalendarFormGridAllDay {"));
});

test("family calendar uses one shared 8-column gutter grid with quiet time rail", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const baseCalendarCss = await readSource("../app/styles/family-calendar.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");
  const globalsCss = await readSource("../app/globals.css");
  const combinedCss = `${baseCalendarCss}\n${compactCss}`;

  assert.ok(globalsCss.includes('@import "./styles/family-calendar-compact-month.css";'));
  assert.ok(calendarSource.includes('className="familyCalendarWeek familyCalendarWeekHeaderRow"'));
  assert.ok(calendarSource.includes('className="familyCalendarWeekDates familyCalendarWeekHeader"'));
  assert.ok(!calendarSource.includes("familyCalendarWeekHeaderShell"));
  assert.ok(calendarSource.includes('className="familyCalendarExpandedWeek"'));
  assert.ok(calendarSource.includes('<span className="familyCalendarTimeRailSpacer familyCalendarTimeRailSpacerEmpty" aria-hidden="true" />'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeRow"'));
  assert.ok(calendarSource.includes('className="familyCalendarTimeLabel"'));
  assert.ok(calendarSource.includes('className="familyCalendarDaySlot"'));
  assert.ok(!calendarSource.includes('className="familyCalendarWeekCounts"'));
  assert.ok(
    calendarSource.indexOf('className="familyCalendarTimeLabel"') <
      calendarSource.indexOf('className="familyCalendarDaySlot"'),
    "time label should render before day slots, not inside a day cell",
  );

  assert.ok(compactCss.includes(".familyCalendarWeekHeaderRow {"));
  assert.ok(compactCss.includes("border-color: transparent;"));
  assert.ok(compactCss.includes(".familyCalendarWeekHeader,"));
  assert.ok(compactCss.includes(".familyCalendarWeekDates,"));
  assert.ok(compactCss.includes(".familyCalendarWeekCounts,"));
  assert.ok(compactCss.includes(".familyCalendarTimeRow {"));
  assert.ok(compactCss.includes("grid-template-columns: var(--family-calendar-expanded-rail-width, 34px) repeat(7, minmax(0, 1fr));"));
  assert.ok(compactCss.includes("grid-template-columns: var(--family-calendar-expanded-rail-width, 28px) repeat(7, minmax(0, 1fr));"));
  assert.doesNotMatch(compactCss, /familyCalendarWeekHeaderShell/);
  assert.match(compactCss, /\.familyCalendarTimeRailSpacer\s*\{[\s\S]*?display:\s*block;[\s\S]*?pointer-events:\s*none;/);
  assert.match(compactCss, /\.familyCalendarTimeRailSpacerEmpty::before\s*\{[\s\S]*?content:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekToggle\s*\{[\s\S]*?width:\s*24px;[\s\S]*?height:\s*24px;[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*#fff;/);
  assert.match(compactCss, /\.familyCalendarWeekToggle \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekDates \.familyCalendarTimeRailSpacer::before\s*\{[\s\S]*?content:\s*"";[\s\S]*?border-top:\s*5px solid transparent;[\s\S]*?border-bottom:\s*5px solid transparent;[\s\S]*?border-left:\s*7px solid rgba\(92,\s*50,\s*68,\s*0\.42\);/);
  assert.match(compactCss, /\.familyCalendarWeekSelected \.familyCalendarWeekDates \.familyCalendarTimeRailSpacer::before\s*\{[\s\S]*?border-top:\s*7px solid rgba\(92,\s*50,\s*68,\s*0\.42\);[\s\S]*?border-right:\s*5px solid transparent;[\s\S]*?border-bottom:\s*0;[\s\S]*?border-left:\s*5px solid transparent;/);
  assert.doesNotMatch(compactCss, /Symbols Nerd Font||/);
  assert.match(
    compactCss,
    /\.familyCalendarWeekHeader span,\s*\n\.familyCalendarWeekDay,\s*\n\.familyCalendarWeekCounts span\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?padding:\s*0;[\s\S]*?text-align:\s*center;/,
  );
  assert.match(compactCss, /\.familyCalendarWeekHeader \.familyCalendarTimeRailSpacer,\s*\n\.familyCalendarWeekCounts \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekHeaderDay:first-of-type\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*rgba\(255, 216, 229, 0\.38\);[\s\S]*?color:\s*#d86f98;/);
  assert.match(compactCss, /\.familyCalendarWeekHeaderDay:last-of-type\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*rgba\(219, 234, 254, 0\.42\);[\s\S]*?color:\s*#4f8bcf;/);
  assert.match(compactCss, /\.familyCalendarWeekDates > \.familyCalendarWeekDateButton:nth-child\(2\),\s*\n\.familyCalendarWeekCounts > span:nth-child\(2\)\s*\{[\s\S]*?color:\s*#d86f98;/);
  assert.match(compactCss, /\.familyCalendarWeekDates > \.familyCalendarWeekDateButton:nth-child\(8\),\s*\n\.familyCalendarWeekCounts > span:nth-child\(8\)\s*\{[\s\S]*?color:\s*#4f8bcf;/);
  assert.match(compactCss, /\.familyCalendarExpandedWeek::before,\s*\n\.familyCalendarExpandedWeek::after\s*\{[\s\S]*?width:\s*var\(--family-calendar-expanded-day-width\);/);
  assert.match(compactCss, /\.familyCalendarExpandedWeek::before\s*\{[\s\S]*?left:\s*calc\(var\(--family-calendar-expanded-rail-width\) \+ var\(--family-calendar-expanded-gap\)\);/);
  assert.match(compactCss, /\.familyCalendarExpandedWeek::after\s*\{[\s\S]*?\* 6\)\);/);
  assert.match(compactCss, /\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(92, 50, 68, 0\.38\);[\s\S]*?font-size:\s*0\.72rem;[\s\S]*?font-weight:\s*600;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarWeekToggle\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(92, 50, 68, 0\.32\);[\s\S]*?font-size:\s*0\.66rem;/);
  assert.match(compactCss, /\.familyCalendarTimeLabel::after\s*\{[\s\S]*?rgba\(214, 128, 157, 0\.1\)/);
  assert.ok(combinedCss.includes(".familyCalendarDaySlot {"));
  assert.ok(combinedCss.includes("min-width: 0;"));
  assert.ok(combinedCss.includes("overflow: hidden;"));
  assert.ok(combinedCss.includes("text-overflow: ellipsis;"));
  assert.ok(combinedCss.includes("white-space: nowrap;"));
});
