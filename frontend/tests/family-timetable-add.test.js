import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

const FAMILY_TIMETABLE_COLOR_KEYS = [
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
];

const FAMILY_TIMETABLE_COLOR_LABELS = [
  "분홍",
  "연분홍",
  "크림",
  "노랑",
  "살구",
  "민트",
  "초록",
  "하늘",
  "파랑",
  "보라",
  "라벤더",
  "회색",
];

test("family timetable keeps local schedule editor foundations", async () => {
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const globalsCss = await readSource("../app/globals.css");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  for (const value of [
    "로운이",
    "주간시간표",
    "+ 시간표",
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
    "일정 이름을 입력해주세요.",
  ]) {
    assert.ok(roniSource.includes(value), `${value} should remain in Roun timetable editor sources`);
  }

  const weekdaySources = `${roniSource}\n${dataSource}`;
  for (const day of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(weekdaySources.includes(day), `${day} should remain available to the Roun editor`);
  }
  for (const value of ["dayOfWeek", "startTime", "endTime", "color", "fontFamily", "normalizeFamilyRoniItem"]) {
    assert.ok(roniSource.includes(value));
  }
  assert.ok(globalsCss.includes("family-timetable-add.css"));
  assert.ok(globalsCss.includes("family-roni-templates.css"));
  assert.ok(addCss.includes(".familyTimetableSlot"));
  assert.ok(addCss.includes("pointer-events: none"));
  assert.ok(addCss.includes(".familyTimetableColorChips"));
  assert.ok(addCss.includes("font-size: 0"));
  assert.ok(addCss.includes(".familyTimetableCopyPills"));
});

test("family timetable exposes twelve fixed pastel color options", async () => {
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  assert.match(roniSource, /FAMILY_RONI_COLORS\s*=\s*\[/);
  assert.equal(FAMILY_TIMETABLE_COLOR_KEYS.length, 12);
  for (const color of FAMILY_TIMETABLE_COLOR_KEYS) {
    assert.ok(`${roniSource}\n${dataSource}`.includes(`"${color}"`), `${color} should be in the color preset list`);
    const className = `${color[0].toUpperCase()}${color.slice(1)}`;
    assert.match(addCss, new RegExp(`\\.familyTimetableEntry${className}`));
    assert.match(addCss, new RegExp(`\\.familyTimetableColorChip${className}`));
  }
  for (const label of FAMILY_TIMETABLE_COLOR_LABELS) {
    assert.ok(roniSource.includes(label), `${label} should remain as a Korean color label`);
  }
  assert.match(dataSource, /DEFAULT_FAMILY_CALENDAR_COLOR\s*=\s*"pink"/);
  assert.match(addCss, /\.familyTimetableColorChipActive/);
});

test("family Roun timetable uses template library plus date-based assignments", async () => {
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const routeSource = await readSource("../app/family/roun/page.js");

  for (const value of [
    "kaosgdd.family.rounWeeklyPlans.v1",
    "kaosgdd.family.rounAssignments.v1",
    "plans",
    "assignments",
    "loadFamilyRounState",
    "saveFamilyRounState",
    "updateFamilyRounPlanItems",
    "resolveFamilyRounPlanForDate",
    "normalizeFamilyRounAssignment",
  ]) {
    assert.ok(dataSource.includes(value), `${value} should exist in Roun timeline data source`);
  }

  assert.ok(!dataSource.includes("activeTemplateId"), "Roun should not use an active-star template model");
  assert.ok(routeSource.includes("FamilyRoniClient"), "/family/roun should render the Roun timetable editor");

  for (const value of [
    "로운이",
    "주간시간표",
    "시간표 저장",
    "새 시간표",
    "시간표 이름",
    "시간표 이름을 입력해주세요.",
    "적용하기",
    "적용 이력",
    "몇년 몇월 몇일부터 적용할까요?",
    "고치기",
    "복사",
    "삭제",
  ]) {
    assert.ok(roniSource.includes(value), `${value} should exist in Roun template UI`);
  }

  assert.ok(roniSource.includes('type="date"'), "applying a Roun template should use a date picker");
  assert.ok(roniSource.includes("assignments: [...rounState.assignments, nextAssignment]"), "repeated template assignments should be appended as timeline entries");
  assert.ok(roniSource.includes("deleteAssignment"), "assignment deletion should be available");
  assert.ok(roniSource.includes("rounState.assignments.filter((assignment) => assignment.id !== assignmentId)"), "deleting an assignment should not delete a template");

  for (const preservedField of ["color", "fontFamily", "memo", "startTime", "endTime", "dayOfWeek"]) {
    assert.ok(dataSource.includes(preservedField), `${preservedField} should be preserved in template entries`);
  }
  assert.ok(roniSource.includes("+ 시간표"), "+ 시간표 should remain the Roun add-entry action");
  assert.ok(!roniSource.includes("+ 일정"), "+ 일정 should not be used inside the Roun timetable editor");

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자"]) {
    assert.ok(!roniSource.includes(oldString), `${oldString} should not appear in Roun template UI`);
  }
});
