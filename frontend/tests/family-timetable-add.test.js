import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family timetable keeps explicit add path and inert empty cells", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  assert.ok(globalsCss.includes("family-timetable-add.css"));
  assert.ok(timetableSource.includes("+ 일정"));
  assert.ok(timetableSource.includes("onClick={startNewEntry}"));
  assert.ok(timetableSource.includes("setEditorDraft(createNewScheduleDraft"));
  assert.ok(timetableSource.includes('className="familyTimetableSlot"'));
  assert.ok(timetableSource.includes('aria-hidden="true"'));
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.match(addCss, /\.familyTimetableSlot\s*\{[\s\S]*?pointer-events:\s*none;/);
});

test("family timetable validates title and slot values before save", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.ok(timetableSource.includes("const title = editorDraft.title.trim();"));
  assert.ok(timetableSource.includes("일정 이름을 입력해주세요."));
  assert.ok(timetableSource.includes("function parseEditorSlot"));
  assert.ok(timetableSource.includes("요일을 확인해주세요."));
  assert.ok(timetableSource.includes("시간을 확인해주세요."));
  assert.ok(timetableSource.includes("normalizeEditorSlots(editorDraft.slots)"));
  assert.ok(timetableSource.includes("setEditorError(slotError)"));
});

test("family timetable keeps legacy recovery while storing grouped slots", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.ok(timetableSource.includes("kaosgdd.family.defaultTimetable.v1"));
  assert.ok(timetableSource.includes("function normalizeDayOfWeek"));
  assert.ok(timetableSource.includes("return isValidDayOfWeek(value) ? value : 1;"));
  assert.ok(timetableSource.includes("function slotsFromEntry"));
  assert.ok(timetableSource.includes("Array.isArray(entry?.slots)"));
  for (const value of ["dayOfWeek", "startTime", "endTime", "slots", "firstSlot.dayOfWeek"]) {
    assert.ok(timetableSource.includes(value));
  }
});

test("family timetable displays Sunday-first week order with weekend hints", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  const sundayIndex = timetableSource.indexOf('label: "일"');
  const mondayIndex = timetableSource.indexOf('label: "월"');
  assert.ok(sundayIndex >= 0 && mondayIndex > sundayIndex);
  for (const optionLabel of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(timetableSource.includes(`optionLabel: "${optionLabel}"`));
  }
  assert.ok(timetableSource.includes('return "Sunday"'));
  assert.ok(timetableSource.includes('return "Saturday"'));
  assert.ok(timetableSource.includes('dayClassName("familyTimetableDayHeader"'));
  assert.ok(timetableSource.includes('dayClassName("familyTimetableDayColumn"'));
  assert.ok(addCss.includes("familyTimetableDayHeaderSunday"));
  assert.ok(addCss.includes("familyTimetableDayColumnSunday"));
  assert.ok(addCss.includes("familyTimetableDayHeaderSaturday"));
  assert.ok(addCss.includes("familyTimetableDayColumnSaturday"));
});

test("family timetable time-slot rows use underline controls", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  for (const value of [
    "editorDraft.slots.map",
    'className="familyTimetableSlotRow"',
    "요일",
    "familyTimetableSlotSeparator",
    "+ 시간 추가",
    "editorDraft.slots.length <= 1",
    'aria-label="시간 삭제"',
  ]) {
    assert.ok(timetableSource.includes(value));
  }
  for (const optionLabel of ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]) {
    assert.ok(timetableSource.includes(`optionLabel: "${optionLabel}"`));
  }
  assert.ok(timetableSource.includes("{day.optionLabel}"));

  for (const cssValue of [
    ".familyTimetableSlotRows",
    "max-width: 100%",
    ".familyTimetableSlotRow",
    "display: grid",
    "grid-template-columns: 88px minmax(0, 1fr) 16px minmax(0, 1fr) 28px",
    "column-gap: 8px",
    "border-bottom: 2px solid rgba(214, 128, 157, 0.34)",
    "text-align: center",
    "text-align-last: center",
    "box-sizing: border-box",
    "position: static",
    "background: transparent",
    "width: 28px",
    "grid-template-columns: 76px minmax(0, 1fr) 14px minmax(0, 1fr) 24px",
  ]) {
    assert.ok(addCss.includes(cssValue));
  }
});

test("family timetable color chips are a 6x2 color-only accessible grid", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  assert.ok(timetableSource.includes("aria-label={FAMILY_TIMETABLE_COLOR_LABELS[color]}"));
  assert.ok(timetableSource.includes("title={FAMILY_TIMETABLE_COLOR_LABELS[color]}"));
  assert.ok(timetableSource.includes("disabled={unavailable}"));
  assert.ok(timetableSource.includes("familyTimetableColorChipDisabled"));
  assert.doesNotMatch(timetableSource, /familyTimetableColorChipLabel/);

  for (const cssValue of [
    ".familyTimetableColorChips",
    "display: grid",
    "grid-template-columns: repeat(6, 44px)",
    "align-items: center",
    ".familyTimetableColorChip",
    "width: 44px",
    "height: 44px",
    "border-radius: 999px",
    "padding: 0",
    "font-size: 0",
    "color: transparent",
    "familyTimetableColorChipActive",
    "familyTimetableColorChipDisabled",
    "grid-template-columns: repeat(6, 42px)",
  ]) {
    assert.ok(addCss.includes(cssValue));
  }
});

test("family timetable color uniqueness and copy pills remain", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  for (const value of [
    "function getUsedScheduleColors",
    "function getFirstAvailableColor",
    "function colorIsUnavailable",
    "usedEditorColors.has(color)",
    "saveUsedColors.has(selectedColor)",
    "editorDraft.isNew && visibleEntries.length > 0",
    "copyEntryToNewDraft(entry)",
    "복사해서 만들기",
  ]) {
    assert.ok(timetableSource.includes(value));
  }
  for (const cssValue of [".familyTimetableCopyPills", "display: flex", "overflow-x: auto", ".familyTimetableCopyPill", "flex: 0 0 auto"]) {
    assert.ok(addCss.includes(cssValue));
  }
  for (const dayLabel of ["일", "월", "화", "수", "목", "금", "토"]) {
    assert.ok(timetableSource.includes(`label: "${dayLabel}"`));
  }
  assert.ok(familyCss.includes("overflow-x: hidden"));
  assert.ok(familyCss.includes("grid-template-columns: 24px repeat(7, minmax(0, 1fr))"));
});
