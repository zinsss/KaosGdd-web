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
  "크림",
  "노랑",
  "민트",
  "초록",
  "하늘",
  "파랑",
  "보라",
  "라벤더",
  "회색",
];

test("family timetable keeps local schedule editor foundations", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const globalsCss = await readSource("../app/globals.css");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  for (const value of [
    "kaosgdd.family.defaultTimetable.v1",
    "+ 일정",
    "일정 이름",
    "요일",
    "시작",
    "끝",
    "색상",
    "메모",
    "저장",
    "취소",
    "삭제",
    "일정 이름을 입력해주세요.",
    "+ 시간 추가",
  ]) {
    assert.ok(timetableSource.includes(value), `${value} should remain in timetable editor sources`);
  }

  for (const day of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(timetableSource.includes(day));
  }
  for (const value of ["slots", "dayOfWeek", "startTime", "endTime", "copyEntryToNewDraft", "normalizeEditorSlots"]) {
    assert.ok(timetableSource.includes(value));
  }
  assert.ok(globalsCss.includes("family-timetable-add.css"));
  assert.ok(addCss.includes(".familyTimetableSlot"));
  assert.ok(addCss.includes("pointer-events: none"));
  assert.ok(addCss.includes(".familyTimetableColorChips"));
  assert.ok(addCss.includes("font-size: 0"));
  assert.ok(addCss.includes(".familyTimetableCopyPills"));
});

test("family timetable exposes twelve fixed pastel color options", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  assert.match(timetableSource, /FAMILY_TIMETABLE_COLORS\s*=\s*\[/);
  assert.equal(FAMILY_TIMETABLE_COLOR_KEYS.length, 12);
  for (const color of FAMILY_TIMETABLE_COLOR_KEYS) {
    assert.ok(timetableSource.includes(`"${color}"`), `${color} should be in the color preset list`);
    const className = `${color[0].toUpperCase()}${color.slice(1)}`;
    assert.match(addCss, new RegExp(`\\.familyTimetableEntry${className}`));
    assert.match(addCss, new RegExp(`\\.familyTimetableColorChip${className}`));
  }
  for (const label of FAMILY_TIMETABLE_COLOR_LABELS) {
    assert.ok(timetableSource.includes(label), `${label} should remain as a Korean color label`);
  }
  assert.match(timetableSource, /normalizeTimetableColor\(color, fallback = "pink"\)/);
  assert.match(timetableSource, /color:\s*"pink"/);
  assert.match(addCss, /\.familyTimetableColorChipActive/);
});
