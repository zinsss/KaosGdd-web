import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "./test-helpers.js";

test("family calendar uses finalized standard Korean wording", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/FamilyCalendarEventFormClient.js");
  const roniSource = await readSource("../app/family/roun/page.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const polishCss = await readSource("../app/styles/family-polish.css");
  const combinedSource = `${calendarSource}
${eventFormSource}
${roniSource}`;

  for (const label of [
    "달력",
    "메모장",
    "할일",
    "로운이",
    "로우니 시간표",
    "일정",
    "일정 옵션",
    "이번 주만 변경",
    "이번 주만 일정 취소",
    "로우니 기본 시간표도 변경",
    "되돌리기",
    "+ 일정",
    "일정 추가",
    "일정 수정",
    "일정 이름",
    "요일",
    "시작",
    "끝",
    "색상",
    "글씨체",
    "메모",
    "저장",
    "취소",
    "삭제",
  ]) {
    assert.ok(combinedSource.includes(label), `expected Family calendar UI to include ${label}`);
  }

  for (const banned of [
    "고치까",
    "치아라",
    "다했데이",
    "도로묵이다",
    "고마하자",
    "이번 주만 치아라",
    "로니도 바꾸기",
  ]) {
    assert.ok(!combinedSource.includes(banned), `did not expect deprecated wording ${banned}`);
  }

  assert.ok(dataSource.includes("fontFamily: normalizeFamilyTimetableFontFamily(item.fontFamily),"));
  assert.ok(dataSource.includes('if (String(next.fontFamily || "") === "Hyunok") next.fontFamily = "system";'));
  assert.ok(!combinedSource.includes("Hyunok"));
  assert.ok(!combinedSource.includes("현옥"));
  assert.ok(!calendarCss.includes("Hyunok"));
  assert.ok(polishCss.includes("로운이와 나"));
});

test("family calendar all-day marker defaults the form and renders a top all-day row", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/FamilyCalendarEventFormClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.ok(calendarSource.includes('href="/family/calendar/events/new?allDay=1"'));
  assert.ok(eventFormSource.includes('const defaultAllDay = searchParams.get("allDay") === "1";'));
  assert.ok(eventFormSource.includes('const defaultDate = searchParams.get("date") || formatFamilyDateKey(new Date());'));
  assert.ok(eventFormSource.includes('const initialAllDay = item?.allDay ?? defaultAllDay;'));
  assert.ok(eventFormSource.includes('allDay: initialAllDay,'));
  assert.ok(eventFormSource.includes('checked={draft.allDay}'));
  assert.ok(eventFormSource.includes('type="checkbox"'));
  assert.ok(eventFormSource.includes('{draft.allDay ? null : ('));
  assert.ok(eventFormSource.includes('className="familyCalendarFormGrid familyCalendarFormGridAllDay"'));
  assert.ok(eventFormSource.includes('placeholder="새 일정"'));
  assert.ok(eventFormSource.includes('allDay: Boolean(item.allDay),'));
  assert.ok(eventFormSource.includes('const normalizedAllDay = Boolean(next.allDay);'));
  assert.ok(eventFormSource.includes('startTime: normalizedAllDay ? "" : String(next.startTime || ""),'));
  assert.ok(eventFormSource.includes('endTime: normalizedAllDay ? "" : String(next.endTime || ""),'));
  assert.ok(dataSource.includes('allDay: Boolean(item.allDay),'));
  assert.ok(dataSource.includes('allDay: Boolean(item.allDay),'));

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

test("family calendar uses one shared 8-column gutter grid with clean weekend text styling", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const baseCalendarCss = await readSource("../app/styles/family-calendar.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");
  const globalsCss = await readSource("../app/globals.css");
  const combinedCss = `${baseCalendarCss}
${compactCss}`;

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
  assert.match(compactCss, /\.familyCalendarWeekCounts\s*\{[\s\S]*?display:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekToggle\s*\{[\s\S]*?width:\s*auto;[\s\S]*?height:\s*auto;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekToggle \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?width:\s*14px;[\s\S]*?min-width:\s*14px;[\s\S]*?min-height:\s*14px;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekDates \.familyCalendarTimeRailSpacer::before\s*\{[\s\S]*?content:\s*"";[\s\S]*?border-top:\s*5px solid transparent;[\s\S]*?border-bottom:\s*5px solid transparent;[\s\S]*?border-left:\s*7px solid rgba\(92,\s*50,\s*68,\s*0\.42\);/);
  assert.ok(compactCss.includes('.familyCalendarWeekSelected .familyCalendarWeekDates .familyCalendarTimeRailSpacer::before {'));
  assert.ok(compactCss.includes('content: "♥";'));
  assert.ok(compactCss.includes('border: 0;'));
  assert.ok(compactCss.includes('color: rgba(216, 111, 152, 0.78);'));
  assert.doesNotMatch(compactCss, /Symbols Nerd Font|\uf460|\uf47c/);
  assert.match(
    compactCss,
    /\.familyCalendarWeekHeader span,\s*\n\.familyCalendarWeekDay,\s*\n\.familyCalendarWeekCounts span\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?padding:\s*0;[\s\S]*?text-align:\s*center;/,
  );
  assert.match(compactCss, /\.familyCalendarWeekHeader \.familyCalendarTimeRailSpacer,\s*\n\.familyCalendarWeekCounts \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.ok(compactCss.includes('.familyCalendarWeekHeader > .familyCalendarWeekHeaderDay:nth-child(2),'));
  assert.ok(compactCss.includes('.familyCalendarWeekHeader > .familyCalendarWeekHeaderDay:nth-child(8),'));
  assert.ok(compactCss.includes('color: #d86f98;'));
  assert.ok(compactCss.includes('color: #4f8bcf;'));
  assert.match(compactCss, /\.familyCalendarDateOutside\s*\{[\s\S]*?opacity:\s*0\.35;/);
  assert.ok(compactCss.includes(".familyCalendarWeekSelected {"));
  assert.ok(compactCss.includes("border: 1px solid rgba(214, 128, 157, 0.24);"));
  assert.ok(compactCss.includes("padding: 8px 6px 6px;"));
  assert.ok(compactCss.includes("background: #fffafd;"));
  assert.ok(compactCss.includes(".familyCalendarExpandedWeek {"));
  assert.ok(compactCss.includes("border: 0;"));
  assert.ok(compactCss.includes("padding: 6px 0 0;"));
  assert.ok(compactCss.includes("background: transparent;"));
  assert.match(compactCss, /\.familyCalendarExpandedWeek::before,\s*\n\.familyCalendarExpandedWeek::after\s*\{[\s\S]*?content:\s*none;/);
  assert.match(compactCss, /\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(92, 50, 68, 0\.38\);[\s\S]*?font-size:\s*0\.72rem;[\s\S]*?font-weight:\s*600;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarWeekToggle \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?width:\s*12px;[\s\S]*?min-width:\s*12px;[\s\S]*?min-height:\s*12px;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(92, 50, 68, 0\.32\);[\s\S]*?font-size:\s*0\.66rem;/);
  assert.match(compactCss, /\.familyCalendarTimeLabel::after\s*\{[\s\S]*?rgba\(214, 128, 157, 0\.1\)/);
  assert.ok(combinedCss.includes(".familyCalendarDaySlot {"));
  assert.ok(combinedCss.includes("min-width: 0;"));
  assert.ok(combinedCss.includes("overflow: hidden;"));
  assert.ok(combinedCss.includes("text-overflow: ellipsis;"));
  assert.ok(combinedCss.includes("white-space: nowrap;"));
});
