import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family timetable keeps explicit add path and inert empty cells", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const globalsCss = await readSource("../app/globals.css");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  assert.ok(globalsCss.includes("family-timetable-add.css"));
  assert.ok(timetableSource.includes("+ 일정"));
  assert.ok(timetableSource.includes("onClick={startNewEntry}"));
  assert.ok(timetableSource.includes("setEditorDraft(createNewScheduleDraft"));
  assert.ok(timetableSource.includes('className="familyTimetableSlot"'));
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.ok(addCss.includes(".familyTimetableSlot"));
  assert.ok(addCss.includes("pointer-events: none"));
});

test("family timetable validates title and slot values before save", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");

  for (const value of [
    "const title = editorDraft.title.trim();",
    "일정 이름을 입력해주세요.",
    "function parseEditorSlot",
    "요일을 확인해주세요.",
    "시간을 확인해주세요.",
    "normalizeEditorSlots(editorDraft.slots)",
  ]) assert.ok(timetableSource.includes(value));
});

test("family timetable keeps structured grouped slots and local storage", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");

  for (const value of ["kaosgdd.family.defaultTimetable.v1", "function normalizeDayOfWeek", "function slotsFromEntry", "Array.isArray(entry?.slots)", "dayOfWeek", "startTime", "endTime", "slots"]) {
    assert.ok(timetableSource.includes(value));
  }
});

test("family timetable displays Sunday-first week order with weekend hints", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  const sundayIndex = timetableSource.indexOf('label: "일"');
  const mondayIndex = timetableSource.indexOf('label: "월"');
  assert.ok(sundayIndex >= 0 && mondayIndex > sundayIndex);
  for (const optionLabel of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(timetableSource.includes(optionLabel));
  }
  for (const selector of ["familyTimetableDayHeaderSunday", "familyTimetableDayColumnSunday", "familyTimetableDayHeaderSaturday", "familyTimetableDayColumnSaturday"]) {
    assert.ok(addCss.includes(selector));
  }
});

test("family timetable time-slot rows use compact underline controls", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  for (const value of ["editorDraft.slots.map", 'className="familyTimetableSlotRow"', "요일", "familyTimetableSlotSeparator", "+ 시간 추가", "editorDraft.slots.length <= 1", 'aria-label="시간 삭제"']) {
    assert.ok(timetableSource.includes(value));
  }
  for (const cssValue of [".familyTimetableSlotRow", "display: grid", "grid-template-columns", "border-bottom", "text-align: center", "position: static", "background: transparent"]) {
    assert.ok(addCss.includes(cssValue));
  }
});

test("family timetable color chips remain color-only accessible grid", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");

  assert.ok(timetableSource.includes("aria-label={FAMILY_TIMETABLE_COLOR_LABELS[color]}"));
  assert.ok(timetableSource.includes("title={FAMILY_TIMETABLE_COLOR_LABELS[color]}"));
  assert.ok(timetableSource.includes("disabled={unavailable}"));
  assert.doesNotMatch(timetableSource, /familyTimetableColorChipLabel/);
  for (const cssValue of [".familyTimetableColorChips", "display: grid", "grid-template-columns: repeat(6", ".familyTimetableColorChip", "border-radius: 999px", "font-size: 0", "color: transparent"]) {
    assert.ok(addCss.includes(cssValue));
  }
});

test("family timetable copy pills and mobile seven-day layout remain", async () => {
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const addCss = await readSource("../app/styles/family-timetable-add.css");
  const familyCss = await readSource("../app/styles/family.css");

  for (const value of ["function getUsedScheduleColors", "function getFirstAvailableColor", "function colorIsUnavailable", "copyEntryToNewDraft(entry)", "복사해서 만들기"]) {
    assert.ok(timetableSource.includes(value));
  }
  for (const cssValue of [".familyTimetableCopyPills", "display: flex", "overflow-x: auto", ".familyTimetableCopyPill"]) {
    assert.ok(addCss.includes(cssValue));
  }
  assert.ok(familyCss.includes("overflow-x: hidden"));
  assert.ok(familyCss.includes("repeat(7, minmax(0, 1fr))"));
});
