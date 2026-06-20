import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  FAMILY_CAREGIVER_HOUR_VALUES,
  FAMILY_CAREGIVER_HOURLY_WAGE_STORAGE_KEY,
  FAMILY_CAREGIVER_HOURS_STORAGE_KEY,
  FAMILY_CALENDAR_COLOR_KEYS,
  FAMILY_CALENDAR_COLOR_LABELS,
  formatFamilyCaregiverHours,
  normalizeFamilyCaregiverHour,
  normalizeFamilyCaregiverHourlyWage,
  normalizeFamilyCaregiverHoursMap,
} from "../app/family/calendar/familyCalendarData.js";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar uses finalized standard Korean wording", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const headerSource = await readSource("../app/family/FamilyHeader.js");
  const roniSource = await readSource("../app/family/roun/page.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const combinedSource = `${calendarSource}
${eventFormSource}
${headerSource}
${roniSource}`;

  for (const label of [
    "달력",
    "메모장",
    "할일",
    "로운이",
    "일정",
    "일정 옵션",
    "이번 주만 변경",
    "이번 주만 일정 취소",
    "로운이 시간표 변경",
    "되돌리기",
    "+ 일정",
    "일정 추가",
    "일정 수정",
    "일정 이름",
    "시작",
    "끝",
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

  assert.ok(
    dataSource.includes("fontFamily: normalizeFamilyTimetableFont(item.fontFamily || FAMILY_TIMETABLE_DEFAULT_FONT),"),
  );
  assert.ok(!combinedSource.includes("Hyunok"));
  assert.ok(!combinedSource.includes("현옥"));
  assert.ok(!calendarCss.includes("Hyunok"));
  assert.ok(headerSource.includes("로운이와 나"));
});

test("family calendar all-day marker defaults the form and renders a top all-day row", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const polishCss = await readSource("../app/styles/family-polish.css");

  assert.ok(calendarSource.includes('href="/family/calendar/events/new?allDay=1"'));
  assert.ok(eventFormSource.includes('const allDay = params.get("allDay") === "1";'));
  assert.ok(eventFormSource.includes('const date = validDateParam(params.get("date"));'));
  assert.ok(eventFormSource.includes('function eventPrefillFromLocation() {'));
  assert.ok(eventFormSource.includes('...(allDay ? { allDay: true } : {}),'));
  assert.ok(eventFormSource.includes('checked={draft.allDay}'));
  assert.ok(eventFormSource.includes('type="checkbox"'));
  assert.ok(eventFormSource.includes('{draft.allDay ? null : ('));
  assert.ok(eventFormSource.includes('familyCalendarFormGridAllDay'));
  assert.ok(eventFormSource.includes('className="familyCalendarFormDateField"'));
  assert.equal((eventFormSource.match(/className="familyCalendarFormTimeField"/g) || []).length, 2);
  assert.equal((eventFormSource.match(/취소/g) || []).length, 1);
  assert.ok(!eventFormSource.includes("familyTaskActionButton"));
  assert.ok(eventFormSource.includes('placeholder="새 일정"'));
  assert.ok(eventFormSource.includes('allDay: item.allDay === true,'));
  assert.ok(eventFormSource.includes('allDay: item.allDay === true,'));
  assert.ok(eventFormSource.includes('startTime: item.startTime || "09:00",'));
  assert.ok(eventFormSource.includes('endTime: item.endTime || "09:40",'));
  assert.ok(eventFormSource.includes("FAMILY_CALENDAR_COLOR_KEYS.map"));
  assert.ok(eventFormSource.includes("FAMILY_CALENDAR_COLOR_LABELS[color]"));
  assert.ok(eventFormSource.includes("familyTimetableColorChip"));
  assert.ok(eventFormSource.includes("const [colorPickerOpen, setColorPickerOpen] = useState(false);"));
  assert.ok(eventFormSource.includes("className=\"familyCalendarColorPickerToggle\""));
  assert.ok(eventFormSource.includes("aria-expanded={colorPickerOpen}"));
  assert.ok(eventFormSource.includes("familyCalendarColorPickerSwatch"));
  assert.ok(eventFormSource.includes("{colorPickerOpen ? ("));
  assert.ok(!eventFormSource.includes("colorIsUnavailable"));
  assert.ok(!eventFormSource.includes("familyTimetableColorChipDisabled"));
  assert.ok(roniSource.includes("FAMILY_CALENDAR_COLOR_KEYS.map"));
  assert.deepEqual(FAMILY_CALENDAR_COLOR_KEYS, [
    "pink",
    "rose",
    "cream",
    "yellow",
    "peach",
    "mint",
    "green",
    "sky",
    "blue",
    "purple",
    "lavender",
    "gray",
  ]);
  for (const label of ["분홍", "연분홍", "크림", "노랑", "살구", "민트", "초록", "하늘", "파랑", "보라", "라벤더", "회색"]) {
    assert.ok(Object.values(FAMILY_CALENDAR_COLOR_LABELS).includes(label), `${label} should remain available to event and Roun color pickers`);
  }
  assert.ok(dataSource.includes('const allDay = item.allDay === true;'));
  assert.ok(dataSource.includes('const allDay = item.allDay === true;'));

  assert.ok(calendarSource.includes("function groupAllDayItems(items)"));
  assert.ok(calendarSource.includes("const selectedWeekAllDayItems = useMemo(() => groupAllDayItems(selectedWeekItems), [selectedWeekItems]);"));
  assert.ok(calendarSource.includes("selectedWeekItems.filter((item) => !item.allDay)"));
  assert.match(calendarSource, /function formatEditHourLabel\(hour\)\s*\{\s*return `\$\{hour\}`;\s*\}/);
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
  assert.match(calendarCss, /\.familyCalendarForm,\s*\n\.familyRoniPanel\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?min-width:\s*0;/);
  assert.match(calendarCss, /\.familyCalendarForm,\s*\n\.familyCalendarForm \*,\s*\n\.familyCalendarForm \*::before,\s*\n\.familyCalendarForm \*::after\s*\{[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(calendarCss, /\.familyCalendarForm label\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?overflow:\s*visible;/);
  assert.match(calendarCss, /\.familyCalendarForm input,\s*\n\.familyCalendarForm select,\s*\n\.familyCalendarForm textarea,\s*\n\.familyCalendarForm button\s*\{[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(calendarCss, /\.familyCalendarForm input,\s*\n\.familyCalendarForm select,\s*\n\.familyCalendarForm textarea\s*\{[\s\S]*?width:\s*100%;[\s\S]*?inline-size:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?max-inline-size:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?min-inline-size:\s*0;/);
  assert.match(calendarCss, /\.familyCalendarFormGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?min-width:\s*0;/);
  assert.match(calendarCss, /\.familyCalendarFormDateField,\s*\n\.familyCalendarFormTimeField\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?min-inline-size:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?max-inline-size:\s*100%;[\s\S]*?overflow:\s*visible;/);
  assert.match(calendarCss, /\.familyCalendarFormDateField input,\s*\n\.familyCalendarFormTimeField input\s*\{[\s\S]*?display:\s*block;[\s\S]*?min-inline-size:\s*0;[\s\S]*?max-inline-size:\s*100%;/);
  assert.match(calendarCss, /\.familyCalendarForm \.familyTimetableColorField,\s*\n\.familyCalendarForm \.familyTimetableColorChips\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(calendarCss, /\.familyCalendarColorPickerToggle\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto auto auto;[\s\S]*?min-height:\s*38px;/);
  assert.match(calendarCss, /\.familyCalendarColorPickerSwatch\s*\{[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;/);
  assert.match(calendarCss, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.familyCalendarFormGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?column-gap:\s*10px;[\s\S]*?row-gap:\s*10px;[\s\S]*?\}[\s\S]*?\.familyCalendarFormDateField,\s*\n\s*\.familyCalendarFormGridAllDay \.familyCalendarFormDateField\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/);
  assert.match(calendarCss, /\.familyCalendarFormActions\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
  assert.match(calendarCss, /\.familyCalendarFormActions > \*\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
  assert.match(calendarCss, /\.familyCalendarFormActions \.familyTaskDelete\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/);
  assert.match(polishCss, /\.familyCalendarItemRoni\.familyTimetableEntryPink\s*\{\s*background:\s*#ffc6dc;\s*\}/);
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntryPink\s*\{[\s\S]*?--family-calendar-event-outline:\s*#ffc6dc;[\s\S]*?--family-calendar-event-fill-soft:\s*rgba\(255, 198, 220, 0\.28\);/);
  assert.match(polishCss, /\.familyCalendarItemDated\s*\{[\s\S]*?background:\s*#fffafd;[\s\S]*?box-shadow:\s*inset 0 0 0 2px var\(--family-calendar-event-outline, #ffc6dc\);/);
  assert.match(polishCss, /\.familyCalendarAllDayItem\.familyCalendarItemDated\s*\{[\s\S]*?background:\s*var\(--family-calendar-event-fill-soft, rgba\(255, 198, 220, 0\.28\)\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px var\(--family-calendar-event-outline, #ffc6dc\);/);
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
  assert.ok(calendarSource.includes('className="familyCalendarCaregiverReviewGutter"'));
  assert.ok(calendarSource.includes("familyCalendarTimeRow"));
  assert.ok(calendarSource.includes("familyCalendarTimeLabel"));
  assert.ok(calendarSource.includes("familyCalendarDaySlot"));
  assert.ok(!calendarSource.includes('className="familyCalendarWeekCounts"'));
  assert.ok(
    calendarSource.indexOf("familyCalendarTimeLabel") <
      calendarSource.indexOf("familyCalendarDaySlot"),
    "time label should render before day slots, not inside a day cell",
  );

  assert.ok(compactCss.includes(".familyCalendarWeekHeaderRow {"));
  assert.ok(compactCss.includes("border-color: transparent;"));
  assert.ok(compactCss.includes(".familyCalendarWeekHeader,"));
  assert.ok(compactCss.includes(".familyCalendarWeekDates,"));
  assert.ok(compactCss.includes(".familyCalendarWeekCounts,"));
  assert.ok(compactCss.includes(".familyCalendarTimeRow {"));
  assert.ok(compactCss.includes("grid-template-columns: var(--family-calendar-expanded-rail-width, 20px) repeat(7, minmax(0, 1fr));"));
  assert.doesNotMatch(compactCss, /familyCalendarWeekHeaderShell/);
  assert.match(compactCss, /\.familyCalendarTimeRailSpacer\s*\{[\s\S]*?display:\s*block;[\s\S]*?pointer-events:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekCounts\s*\{[\s\S]*?display:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekToggle\s*\{[\s\S]*?width:\s*auto;[\s\S]*?height:\s*auto;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(compactCss, /\.familyCalendarWeekToggle \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?width:\s*14px;[\s\S]*?min-width:\s*14px;[\s\S]*?min-height:\s*14px;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.ok(compactCss.includes('.familyCalendarWeekDates .familyCalendarTimeRailSpacer::before {'));
  assert.ok(compactCss.includes('content: "•";'));
  assert.ok(compactCss.includes('color: rgba(92, 50, 68, 0.42);'));
  assert.ok(compactCss.includes('.familyCalendarWeekSelected .familyCalendarWeekDates .familyCalendarTimeRailSpacer::before {'));
  assert.ok(compactCss.includes('content: "•";'));
  assert.ok(compactCss.includes('color: rgba(180, 120, 190, 0.72);'));
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
  assert.ok(compactCss.includes(".familyCalendarExpandedWeek.familyCalendarExpandedWeekEditable {"));
  assert.ok(compactCss.includes("max-height: min(64vh, 760px);"));
  assert.ok(compactCss.includes("overflow-y: auto;"));
  assert.ok(compactCss.includes("-webkit-overflow-scrolling: touch;"));
  assert.match(compactCss, /\.familyCalendarExpandedWeek::before,\s*\n\.familyCalendarExpandedWeek::after\s*\{[\s\S]*?content:\s*none;/);
  assert.match(compactCss, /\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(120, 95, 160, 0\.72\);[\s\S]*?font-family:\s*"Sarasa Gothic Mono"[\s\S]*?font-size:\s*10px;[\s\S]*?font-variant-numeric:\s*tabular-nums;[\s\S]*?font-weight:\s*800;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarWeekToggle \.familyCalendarTimeRailSpacer\s*\{[\s\S]*?width:\s*12px;[\s\S]*?min-width:\s*12px;[\s\S]*?min-height:\s*12px;/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?--family-calendar-expanded-rail-width:\s*20px;[\s\S]*?grid-template-columns:\s*var\(--family-calendar-expanded-rail-width, 20px\) repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(compactCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyCalendarTimeLabel\s*\{[\s\S]*?color:\s*rgba\(120, 95, 160, 0\.72\);[\s\S]*?font-size:\s*10px;/);
  assert.match(compactCss, /\.familyCalendarTimeLabel::after\s*\{[\s\S]*?rgba\(214, 128, 157, 0\.1\)/);
  assert.ok(combinedCss.includes(".familyCalendarDaySlot {"));
  assert.ok(combinedCss.includes("min-width: 0;"));
  assert.ok(combinedCss.includes("overflow: hidden;"));
  assert.ok(combinedCss.includes("text-overflow: ellipsis;"));
  assert.ok(combinedCss.includes("white-space: nowrap;"));
});

test("family calendar caregiver hours row stores date-specific half-hour values", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.equal(FAMILY_CAREGIVER_HOURS_STORAGE_KEY, "familyCaregiverHours.v1");
  assert.equal(FAMILY_CAREGIVER_HOUR_VALUES[0], 0);
  assert.equal(FAMILY_CAREGIVER_HOUR_VALUES[1], 0.5);
  assert.equal(FAMILY_CAREGIVER_HOUR_VALUES[2], 1);
  assert.equal(FAMILY_CAREGIVER_HOUR_VALUES[3], 1.5);
  assert.equal(FAMILY_CAREGIVER_HOUR_VALUES.at(-1), 12);
  assert.equal(FAMILY_CAREGIVER_HOUR_VALUES.length, 25);

  assert.equal(formatFamilyCaregiverHours(2), "2");
  assert.equal(formatFamilyCaregiverHours(2.5), "2.5");
  assert.equal(formatFamilyCaregiverHours(0), "");
  assert.equal(normalizeFamilyCaregiverHour(0), null);
  assert.equal(normalizeFamilyCaregiverHour(0.25), null);
  assert.equal(normalizeFamilyCaregiverHour(12.5), null);
  assert.deepEqual(normalizeFamilyCaregiverHoursMap({
    "2026-06-08": 2,
    "2026-06-09": 3.5,
    "2026-06-10": 0,
    bad: 4,
  }), {
    "2026-06-08": 2,
    "2026-06-09": 3.5,
  });

  assert.ok(dataSource.includes('export const FAMILY_CAREGIVER_HOURS_STORAGE_KEY = "familyCaregiverHours.v1";'));
  assert.ok(dataSource.includes("export const FAMILY_CAREGIVER_HOUR_VALUES = Array.from({ length: 25 }, (_, index) => index * 0.5);"));
  assert.ok(calendarSource.includes("delete nextHours[date];"));
  assert.ok(calendarSource.includes("function FamilyCaregiverHoursRow("));
  assert.ok(calendarSource.includes('className="familyCalendarTimeRow familyCalendarCaregiverRow"'));
  assert.ok(calendarSource.includes('<span className="familyCalendarTimeLabel familyCalendarCaregiverLabel">•</span>'));
  assert.ok(calendarSource.includes('className="familyCalendarCaregiverReviewGutter"'));
  assert.ok(calendarSource.includes("href={caregiverReviewHref}"));
  assert.ok(calendarSource.includes("♥"));
  assert.ok(calendarSource.includes("FAMILY_CAREGIVER_HOUR_VALUES.map((value)"));
  assert.ok(calendarSource.includes("setCaregiverHoursByDate(loadFamilyCaregiverHours());"));
  assert.ok(calendarSource.includes("saveFamilyCaregiverHours(nextHours);"));
  assert.ok(calendarSource.includes("family/calendar/caregiver?month="));
  assert.ok(calendarSource.indexOf("<FamilyCalendarWeatherRows") < calendarSource.indexOf("<FamilyCaregiverHoursRow"));
  assert.ok(calendarSource.indexOf("<FamilyCaregiverHoursRow") < calendarSource.indexOf("familyCalendarAllDayRow"));
  assert.ok(calendarCss.includes(".familyCalendarCaregiverRow {"));
  assert.ok(calendarCss.includes(".familyCalendarCaregiverReviewGutter {"));
  assert.match(calendarCss, /\.familyCalendarCaregiverReviewGutter\s*\{[\s\S]*?background:\s*rgba\(255, 216, 229, 0\.44\);[\s\S]*?color:\s*rgba\(180, 120, 190, 0\.72\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(214, 128, 157, 0\.12\);/);
  assert.match(calendarCss, /\.familyCalendarCaregiverLabel,\s*\n\.familyCalendarCaregiverPickerLabel\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?min-height:\s*20px;/);
  assert.match(calendarCss, /\.familyCalendarCaregiverSlot\s*\{[\s\S]*?min-height:\s*19px;[\s\S]*?background:\s*#f2f3ff;[\s\S]*?color:\s*#6c63ff;[\s\S]*?box-shadow:\s*inset 0 0 0 1px #d9d6ff;/);
  assert.match(calendarCss, /\.familyCalendarCaregiverSlotActive\s*\{[\s\S]*?background:\s*#e8eaff;[\s\S]*?color:\s*#5b54d9;[\s\S]*?box-shadow:\s*inset 0 0 0 2px rgba\(153, 145, 255, 0\.46\);/);
  assert.ok(calendarCss.includes(".familyCalendarCaregiverPicker {"));
  assert.ok(calendarCss.includes("grid-column: 2 / -1;"));
});

test("family calendar edit mode drag moves dated items and creates Roun overrides", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  for (const value of [
    "FAMILY_CALENDAR_DRAG_START_MOVE_LIMIT = 8",
    "FAMILY_CALENDAR_AUTO_SCROLL_EDGE_PX = 48",
    "FAMILY_CALENDAR_AUTO_SCROLL_STEP_PX = 14",
    "function movedItemValues(item, target)",
    "const duration = Math.min(eventDurationMinutes(item), rangeEnd - rangeStart);",
    "const boundedStartMinutes = Math.max(rangeStart, Math.min(rangeEnd - duration, target.startMinutes));",
    "const startTime = minutesToFamilyTime(boundedStartMinutes);",
    "const endTime = minutesToFamilyTime(boundedStartMinutes + duration);",
    "function findDropTarget(clientX, clientY)",
    "function itemBaseDragTarget(item)",
    "function adjacentWeekTarget(item, currentTarget, direction)",
    "function dragTargetForItem(item, target)",
    "slotTimeFromRowPoint(clientY, dropElement.getBoundingClientRect(), rowStartMinutes)",
    "function startCalendarItemDrag(event, item)",
    "function moveDatedDrag(event)",
    "function finishDatedDrag(event)",
    "function updateAutoScroll(clientY)",
    "function stopAutoScroll()",
  ]) {
    assert.ok(calendarSource.includes(value), `${value} should exist for edit-mode drag/drop`);
  }

  assert.ok(calendarSource.includes('data-family-calendar-drop={editable ? "time" : undefined}'));
  assert.ok(calendarSource.includes("data-slot-start-minutes={editable ? hourStartMinutes : undefined}"));
  assert.ok(calendarSource.includes('data-family-calendar-drop={selected && editingCalendar ? "date" : undefined}'));
  assert.ok(calendarSource.includes('data-family-calendar-drop="allDay"'));
  assert.ok(calendarSource.includes('className="familyCalendarAllDayItem familyCalendarAllDayItemEditable"'));
  assert.ok(calendarSource.includes("familyCalendarExpandedWeek familyCalendarExpandedWeekEditable familyCalendarExpandedWeekEditing"));
  assert.ok(calendarSource.includes('className="familyCalendarEditModeBadge"'));
  assert.ok(calendarSource.includes("편집 중"));
  assert.ok(calendarSource.includes("if (target.type === \"allDay\")"));
  assert.ok(calendarSource.includes('return `${weekday} 종일`.trim();'));
  assert.ok(calendarSource.includes('const weekDropElement = elements.find((element) => element instanceof HTMLElement && element.dataset.familyCalendarWeekDrop);'));
  assert.ok(calendarSource.includes('return { type: "week", direction };'));
  assert.ok(calendarSource.includes("const nextDate = addFamilyDays(baseDate, direction * 7);"));
  assert.ok(calendarSource.includes("weekKey: formatFamilyDateKey(weekStart),"));
  assert.ok(calendarSource.includes("weekOffset: direction,"));
  assert.ok(calendarSource.includes("if (target.type === \"week\") return adjacentWeekTarget(item, dragState?.target, target.direction);"));
  assert.ok(calendarSource.includes("if (target.type === \"allDay\" && !item.allDay) return null;"));
  assert.ok(calendarSource.includes("if (item.allDay) {"));
  assert.ok(calendarSource.includes("if (target.type === \"time\") return null;"));
  assert.ok(calendarSource.includes("if (moved < FAMILY_CALENDAR_DRAG_START_MOVE_LIMIT && !dragState) return;"));
  assert.ok(calendarSource.includes("event.preventDefault();"));
  assert.ok(calendarSource.includes("draggable={dragEnabledItem ? false : undefined}"));
  assert.ok(calendarSource.includes("onDragStart={dragEnabledItem ? (event) => event.preventDefault() : undefined}"));
  assert.ok(calendarSource.includes('if (event.pointerType === "mouse" && event.button !== 0) return;'));
  assert.ok(calendarSource.includes("event.currentTarget.setPointerCapture?.(event.pointerId);"));
  assert.ok(calendarSource.includes("onClick={dragging || suppressRoniNavigation ? (event) => event.preventDefault() : undefined}"));
  assert.ok(calendarSource.includes("pending?.dragElement?.releasePointerCapture?.(event.pointerId);"));
  assert.ok(calendarSource.includes("onMoveDatedItem(pending.item.id, currentDragState.target);"));
  assert.ok(calendarSource.includes("onCreateRoniOverride(pending.item, currentDragState.target);"));
  assert.ok(!calendarSource.includes("setPendingRoniMove"));
  assert.ok(!calendarSource.includes("moveRoniTemplate"));

  assert.ok(calendarSource.includes("function moveDatedItem(itemId, target)"));
  assert.ok(calendarSource.includes("const moved = movedItemValues(item, target);"));
  assert.ok(calendarSource.includes("if (moved.allDay) {"));
  assert.ok(calendarSource.includes("delete nextItem.startTime;"));
  assert.ok(calendarSource.includes("delete nextItem.endTime;"));
  assert.ok(calendarSource.includes("saveFamilyCalendarItems(nextItems);"));
  assert.ok(calendarSource.includes("function upsertRoniOverride(roniItem, values)"));
  assert.ok(calendarSource.includes('overrideType: values.deleted === true ? "deleted" : "moved",'));
  assert.ok(calendarSource.includes("override.id !== roniItem.overrideId"));
  assert.ok(calendarSource.includes("saveFamilyRoniOverrides(nextOverrides);"));
  assert.ok(dataSource.includes('overrideType: override.overrideType === "deleted" || override.deleted === true ? "deleted" : "moved",'));

  assert.ok(calendarSource.includes("familyCalendarEditItem familyCalendarEditItemInline"));
  assert.ok(calendarSource.includes("onStartDatedDrag={startDatedDrag}"));
  assert.ok(calendarSource.includes("onStartRoniDrag={startRoniDrag}"));
  assert.ok(calendarSource.includes("onPointerMove={moveDatedDrag}"));
  assert.ok(calendarSource.includes("onPointerUp={finishDatedDrag}"));
  assert.ok(calendarSource.includes("dragState?.target?.type === \"time\""));
  assert.ok(calendarSource.includes('data-family-calendar-week-drop="previous"'));
  assert.ok(calendarSource.includes('data-family-calendar-week-drop="next"'));
  assert.ok(calendarSource.includes("familyCalendarWeekDragTargetPrev"));
  assert.ok(calendarSource.includes("familyCalendarWeekDragTargetNext"));
  assert.ok(calendarSource.includes("dragState?.target?.type === \"time\" || dragState?.target?.type === \"allDay\""));
  assert.ok(calendarSource.includes("if (currentDragState.target.weekKey) onSelectDragWeek?.(currentDragState.target);"));
  assert.ok(calendarSource.includes("function selectDragWeek(target)"));
  assert.ok(calendarSource.includes("setMonthDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 12, 0, 0, 0));"));
  assert.ok(calendarSource.includes('className="familyCalendarDropSlotTarget"'));
  assert.ok(calendarSource.includes('className="familyCalendarDragGhost"'));
  assert.ok(calendarSource.includes("function formatDragTargetLabel(target)"));
  assert.ok(calendarSource.includes("if (!target) return \"\";"));
  assert.ok(calendarSource.includes('if (target.type !== "time") return "";'));
  assert.ok(calendarSource.includes("FAMILY_CALENDAR_DAY_LABELS[target.dayIndex]"));
  assert.ok(calendarSource.includes("minutesToFamilyTime(target.startMinutes)"));
  assert.ok(calendarSource.includes('className="familyCalendarDragReadout"'));
  assert.ok(calendarSource.includes('style={{ left: `${dragState.x}px`, top: `${dragState.y - 64}px` }}'));
  assert.ok(calendarSource.includes("{formatDragTargetLabel(dragState.target)}"));
  assert.ok(calendarCss.includes(".familyCalendarEditItem {"));
  assert.ok(calendarCss.includes("touch-action: none;"));
  assert.ok(calendarCss.includes(".familyCalendarDropSlotTarget {"));
  assert.ok(calendarCss.includes(".familyCalendarDragGhost {"));
  assert.ok(calendarCss.includes(".familyCalendarDragReadout {"));
  assert.ok(calendarCss.includes(".familyCalendarAllDayItemEditable {"));
  assert.ok(calendarCss.includes(".familyCalendarAllDaySlotDropTarget {"));
  assert.match(calendarCss, /\.familyCalendarExpandedWeekEditing\s*\{[\s\S]*?border:\s*1px dashed rgba\(180, 120, 190, 0\.45\);[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(180, 120, 190, 0\.12\);/);
  assert.match(calendarCss, /\.familyCalendarEditModeBadge\s*\{[\s\S]*?background:\s*rgba\(245, 235, 255, 0\.82\);[\s\S]*?color:\s*rgba\(110, 75, 145, 0\.88\);/);
  assert.match(calendarCss, /\.familyCalendarEditItem::before,\s*\n\.familyCalendarAllDayItemEditable::before\s*\{[\s\S]*?content:\s*"⋮";[\s\S]*?position:\s*absolute;[\s\S]*?pointer-events:\s*none;/);
  assert.ok(!calendarCss.includes(".familyCalendarTimedItem::before"));
  assert.ok(calendarCss.includes(".familyCalendarWeekDragTarget {"));
  assert.ok(calendarCss.includes(".familyCalendarWeekDragTargetPrev {"));
  assert.ok(calendarCss.includes(".familyCalendarWeekDragTargetNext {"));
  assert.ok(calendarCss.includes(".familyCalendarWeekDragTargetActive {"));
  assert.match(calendarCss, /\.familyCalendarDragReadout\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*9999;[\s\S]*?pointer-events:\s*none;/);
  assert.match(calendarCss, /\.familyCalendarDragReadout\s*\{[\s\S]*?padding:\s*5px 10px;[\s\S]*?font-size:\s*14px;/);
  assert.match(calendarCss, /\.familyCalendarDragReadout\s*\{[\s\S]*?transform:\s*translate\(-50%, -100%\);[\s\S]*?white-space:\s*nowrap;/);
  assert.match(calendarCss, /\.familyCalendarWeekDragTarget\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*auto;/);
});

test("family calendar timed items render by duration across hour boundaries", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");
  const polishCss = await readSource("../app/styles/family-polish.css");

  for (const value of [
    "function timedItemRange(item)",
    "function itemAxisStyle(item, visibleStartMinutes, visibleEndMinutes)",
    "height: `${Math.max(18, end - start)}px`,",
    "function timedItemCoveredHours(item)",
    "Math.ceil(range.end / 60) - 1",
    "function buildTimedWeekSegments(items)",
    "function buildEditTimedWeekSegments(items)",
    "hours: FAMILY_CALENDAR_EDIT_VISIBLE_HOURS",
    "segment.hours.length * FAMILY_CALENDAR_EDIT_HOUR_HEIGHT",
    'className={`familyCalendarTimedArea${editable ? " familyCalendarTimedAreaEditable" : ""}`}',
    'className="familyCalendarTimedItemsLayer"',
    'className="familyCalendarTimedDayLayer"',
    'className={editable ? "familyCalendarEditItem familyCalendarEditItemInline" : "familyCalendarTimedItem"}',
    "style={itemAxisStyle(item, segment.startMinutes, segment.endMinutes)}",
    "buildTimedWeekSegments(selectedWeekItems.filter((item) => !item.allDay))",
    "buildEditTimedWeekSegments(selectedWeekItems.filter((item) => !item.allDay))",
  ]) {
    assert.ok(calendarSource.includes(value), `${value} should support duration-spanning timed items`);
  }

  assert.ok(!calendarSource.includes("function groupItemsByHour(items)"));
  assert.ok(!calendarSource.includes("function buildEditWeekRows(items)"));
  assert.ok(!calendarSource.includes("editItemStyleForHour"));
  assert.ok(calendarCss.includes(".familyCalendarTimedArea {"));
  assert.ok(calendarCss.includes("min-height: var(--family-calendar-timed-area-height);"));
  assert.ok(calendarCss.includes(".familyCalendarTimedItemsLayer {"));
  assert.ok(calendarCss.includes("position: absolute;"));
  assert.ok(calendarCss.includes("inset: 0;"));
  assert.ok(calendarCss.includes("pointer-events: none;"));
  assert.ok(calendarCss.includes(".familyCalendarTimedDayLayer {"));
  assert.ok(calendarCss.includes("position: relative;"));
  assert.ok(calendarCss.includes("min-height: var(--family-calendar-timed-area-height);"));
  assert.ok(calendarCss.includes(".familyCalendarTimedItem {"));
  assert.ok(calendarCss.includes("pointer-events: auto;"));
  assert.match(calendarCss, /\.familyCalendarTimedItem\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?border-radius:\s*4px;[\s\S]*?text-align:\s*center;/);
  assert.match(calendarCss, /\.familyCalendarEditItem\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?border-radius:\s*4px;[\s\S]*?text-align:\s*center;/);
  assert.match(calendarCss, /\.familyCalendarTimedItem,\s*\n\.familyCalendarEditItem\s*\{[\s\S]*?border-radius:\s*4px;/);
  assert.ok(calendarCss.includes(".familyCalendarTimedItem span:first-child,"));
  assert.match(calendarCss, /\.familyCalendarTimedItem span:first-child,\s*\n\.familyCalendarEditItem span:first-child\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?text-align:\s*center;/);
  assert.ok(calendarCss.includes("text-overflow: ellipsis;"));
  assert.ok(compactCss.includes(".familyCalendarTimedItemsLayer"));
  assert.ok(compactCss.includes("grid-template-columns: var(--family-calendar-expanded-rail-width, 20px) repeat(7, minmax(0, 1fr));"));
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntryPink\s*\{[\s\S]*?--family-calendar-event-outline:\s*#ffc6dc;/);
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntryRose\s*\{[\s\S]*?--family-calendar-event-outline:\s*#ffb6a8;/);
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntrySky\s*\{[\s\S]*?--family-calendar-event-outline:\s*#b7f1ff;/);
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntryBlue\s*\{[\s\S]*?--family-calendar-event-outline:\s*#b8c8ff;/);
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntryLavender\s*\{[\s\S]*?--family-calendar-event-outline:\s*#d4ccff;/);
  assert.match(polishCss, /\.familyCalendarItemDated\.familyTimetableEntryPurple\s*\{[\s\S]*?--family-calendar-event-outline:\s*#f0b2e8;/);
  assert.match(polishCss, /\.familyCalendarItemDated\s*\{[\s\S]*?background:\s*#fffafd;[\s\S]*?box-shadow:\s*inset 0 0 0 2px var\(--family-calendar-event-outline, #ffc6dc\);/);
});

test("family caregiver monthly review renders fixed-width calendar and wage summary", async () => {
  const reviewSource = await readSource("../app/family/calendar/caregiver/FamilyCaregiverMonthlyReviewClient.js");
  const reviewPageSource = await readSource("../app/family/calendar/caregiver/page.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");

  assert.equal(FAMILY_CAREGIVER_HOURLY_WAGE_STORAGE_KEY, "familyCaregiverHourlyWage.v1");
  assert.equal(normalizeFamilyCaregiverHourlyWage("15000"), 15000);
  assert.equal(normalizeFamilyCaregiverHourlyWage("15000.9"), 15000);
  assert.equal(normalizeFamilyCaregiverHourlyWage("-1"), 0);

  assert.ok(dataSource.includes('export const FAMILY_CAREGIVER_HOURLY_WAGE_STORAGE_KEY = "familyCaregiverHourlyWage.v1";'));
  assert.ok(dataSource.includes("export function loadFamilyCaregiverHourlyWage()"));
  assert.ok(dataSource.includes("export function saveFamilyCaregiverHourlyWage(value)"));

  assert.ok(reviewPageSource.includes("FamilyCaregiverMonthlyReviewClient"));
  assert.ok(reviewPageSource.includes('title: "돌봄 - KaosGdd"'));
  assert.ok(reviewSource.includes("function buildReviewText("));
  assert.ok(reviewSource.includes("function buildReviewWeeks("));
  assert.ok(reviewSource.includes("function summarizeMonth("));
  assert.ok(reviewSource.includes("function fixedDisplayWidth("));
  assert.ok(reviewSource.includes("const REVIEW_CALENDAR_CELL_WIDTH = 6;"));
  assert.ok(reviewSource.includes("function padCell(value, width = REVIEW_CALENDAR_CELL_WIDTH)"));
  assert.ok(reviewSource.includes('return `${text}${" ".repeat(Math.max(0, width - fixedDisplayWidth(text)))}`;'));
  assert.ok(reviewSource.includes("formatReviewMonth(monthDate)"));
  assert.ok(reviewSource.includes('return `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월 돌봄`;'));
  assert.ok(reviewSource.includes('const calendarIndent = "     ";'));
  assert.ok(reviewSource.includes("const weekdayHeader = FAMILY_CALENDAR_DAY_LABELS.map((label) => padCell(label)).join(\"\");"));
  assert.ok(reviewSource.includes('const separator = "-".repeat(FAMILY_CALENDAR_DAY_LABELS.length * REVIEW_CALENDAR_CELL_WIDTH);'));
  assert.ok(reviewSource.includes("`${calendarIndent}${weekdayHeader}`"));
  assert.ok(reviewSource.includes("`${calendarIndent}${separator}`"));
  assert.ok(reviewSource.includes('if (index > 0) lines.push("");'));
  assert.ok(reviewSource.includes("lines.push(`${calendarIndent}${week.map((day) => padCell(day?.day || \"\")).join(\"\")}`);"));
  assert.ok(!reviewSource.includes("`       ${FAMILY_CALENDAR_DAY_LABELS"));
  assert.ok(!reviewSource.includes("`       ${week.map"));
  assert.ok(reviewSource.includes('formatFamilyCaregiverHours(day.hours) || "0"'));
  assert.ok(reviewSource.includes("summary.days += 1;"));
  assert.ok(reviewSource.includes("summary.hours += day.hours;"));
  assert.ok(reviewSource.includes("const totalWage = summary.hours * hourlyWage;"));
  assert.ok(reviewSource.includes("saveFamilyCaregiverHourlyWage(nextWage);"));
  assert.ok(reviewSource.includes('aria-label="시간당 보수"'));
  assert.ok(reviewSource.includes('type="text"'));
  assert.ok(reviewSource.includes('className="familyCaregiverWageField"'));
  assert.ok(reviewSource.includes('href={`/family/calendar?month=${monthParam}`}'));
  assert.ok(reviewSource.includes("달력으로"));
  assert.ok(reviewSource.includes("이번 달 총 일수/시간"));
  assert.ok(reviewSource.includes("시간당 보수"));
  assert.ok(reviewSource.includes("이번 달 보수"));
  assert.ok(reviewSource.includes('.toLocaleString("ko-KR")'));

  assert.ok(calendarCss.includes(".caregiverMonthlyReviewText {"));
  assert.match(calendarCss, /\.caregiverMonthlyReviewText\s*\{[\s\S]*?font-family:\s*"Sarasa Gothic Mono", "Noto Sans Mono CJK KR", "D2Coding", "SFMono-Regular", "Menlo", "Consolas", monospace;/);
  assert.match(calendarCss, /\.caregiverMonthlyReviewText\s*\{[\s\S]*?text-align:\s*left;/);
  assert.match(calendarCss, /\.caregiverMonthlyReviewText\s*\{[\s\S]*?white-space:\s*pre;/);
  assert.match(calendarCss, /\.caregiverMonthlyReviewText\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums;/);
  assert.ok(calendarCss.includes(".familyCaregiverReviewSummary {"));
  assert.ok(calendarCss.includes(".familyCaregiverWageField {"));
  assert.ok(calendarCss.includes(".familyCaregiverReviewBack {"));
});
