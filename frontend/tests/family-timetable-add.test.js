import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\s*\{[^}]*\}`));
  return match ? match[0] : "";
}

test("family timetable keeps explicit add path and inert empty cells", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const slotCss = cssBlock(addCss, ".familyTimetableSlot");

  assert.match(globalsCss, /@import "\.\/styles\/family-timetable-add\.css";/);
  assert.match(timetableSource, />\s*\+ 일정\s*<\/button>/);
  assert.match(timetableSource, /onClick=\{startNewEntry\}/);
  assert.match(timetableSource, /setEditorDraft\(createNewScheduleDraft/);
  assert.match(timetableSource, /<span\s+className="familyTimetableSlot"/);
  assert.match(timetableSource, /aria-hidden="true"/);
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.match(slotCss, /pointer-events:\s*none;/);
});

test("family timetable validates title and slot values before save", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.match(timetableSource, /const title = editorDraft\.title\.trim\(\);/);
  assert.match(timetableSource, /setEditorError\("일정 이름을 입력해주세요\."\);/);
  assert.match(timetableSource, /function parseEditorSlot\(slot\)/);
  assert.match(timetableSource, /return \{ error: "요일을 확인해주세요\." \};/);
  assert.match(timetableSource, /return \{ error: "시간을 확인해주세요\." \};/);
  assert.match(timetableSource, /const \{ slots, error: slotError \} = normalizeEditorSlots\(editorDraft\.slots\);/);
  assert.match(timetableSource, /setEditorError\(slotError\);/);
});

test("family timetable keeps legacy recovery while storing grouped slots", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
  assert.match(timetableSource, /function normalizeDayOfWeek\(dayOfWeek\)/);
  assert.match(timetableSource, /return isValidDayOfWeek\(value\) \? value : 1;/);
  assert.match(timetableSource, /function slotsFromEntry\(entry\)/);
  assert.match(timetableSource, /Array\.isArray\(entry\?\.slots\) && entry\.slots\.length > 0/);
  assert.match(timetableSource, /dayOfWeek:\s*entry\?\.dayOfWeek/);
  assert.match(timetableSource, /startTime:\s*entry\?\.startTime/);
  assert.match(timetableSource, /endTime:\s*entry\?\.endTime/);
  assert.match(timetableSource, /slots,/);
  assert.match(timetableSource, /dayOfWeek:\s*firstSlot\.dayOfWeek/);
});

test("family timetable time-slot rows match the reference grid", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const slotRowCss = cssBlock(addCss, ".familyTimetableSlotRow");
  const removeButtonCss = cssBlock(addCss, ".familyTimetableSlotRemove");

  assert.match(timetableSource, /editorDraft\.slots\.map\(\(slot, slotIndex\) =>/);
  assert.match(timetableSource, /className="familyTimetableSlotRow"/);
  assert.match(timetableSource, />\s*\+ 시간 추가\s*<\/button>/);
  assert.match(timetableSource, /disabled=\{editorDraft\.slots\.length <= 1\}/);
  assert.match(timetableSource, /aria-label="시간 삭제"/);

  assert.match(slotRowCss, /display:\s*grid;/);
  assert.match(slotRowCss, /grid-template-columns:\s*88px 128px 128px 48px;/);
  assert.match(slotRowCss, /column-gap:\s*12px;/);
  assert.match(slotRowCss, /row-gap:\s*8px;/);
  assert.match(slotRowCss, /width:\s*max-content;/);
  assert.match(slotRowCss, /max-width:\s*100%;/);
  assert.match(slotRowCss, /align-items:\s*end;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\],\s*\.familyTimetableSlotRemove\s*\{[\s\S]*height:\s*48px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\],\s*\.familyTimetableSlotRemove\s*\{[\s\S]*min-height:\s*48px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\],\s*\.familyTimetableSlotRemove\s*\{[\s\S]*max-height:\s*48px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\],\s*\.familyTimetableSlotRemove\s*\{[\s\S]*box-sizing:\s*border-box;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\]\s*\{[\s\S]*padding:\s*0 14px;/);
  assert.match(removeButtonCss, /justify-self:\s*start;/);
  assert.match(removeButtonCss, /width:\s*48px;/);
  assert.match(removeButtonCss, /min-width:\s*48px;/);
  assert.doesNotMatch(removeButtonCss, /position:\s*absolute;/);
  assert.doesNotMatch(removeButtonCss, /margin-[^:]+:\s*-/);
  assert.match(addCss, /@media \(max-width: 430px\) \{[\s\S]*grid-template-columns:\s*72px minmax\(96px, 1fr\) minmax\(96px, 1fr\) 44px;/);
  assert.match(addCss, /@media \(max-width: 430px\) \{[\s\S]*height:\s*44px;/);
});

test("family timetable color chips are a 6x2 color-only accessible grid", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const colorChipsCss = cssBlock(addCss, ".familyTimetableColorChips");
  const colorChipCss = cssBlock(addCss, ".familyTimetableColorChip");
  const activeChipCss = cssBlock(addCss, ".familyTimetableColorChipActive");

  assert.match(timetableSource, /aria-label=\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.match(timetableSource, /title=\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.match(timetableSource, /disabled=\{unavailable\}/);
  assert.match(timetableSource, /familyTimetableColorChipDisabled/);
  assert.doesNotMatch(timetableSource, /<button[\s\S]*>\s*\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}\s*<\/button>/);
  assert.doesNotMatch(timetableSource, /className="familyTimetableColorChipLabel"/);

  assert.match(colorChipsCss, /display:\s*grid;/);
  assert.match(colorChipsCss, /grid-template-columns:\s*repeat\(6, 44px\);/);
  assert.match(colorChipsCss, /align-items:\s*center;/);
  assert.match(colorChipCss, /width:\s*44px;/);
  assert.match(colorChipCss, /height:\s*44px;/);
  assert.match(colorChipCss, /min-width:\s*44px;/);
  assert.match(colorChipCss, /min-height:\s*44px;/);
  assert.match(colorChipCss, /border-radius:\s*999px;/);
  assert.match(colorChipCss, /padding:\s*0;/);
  assert.match(colorChipCss, /font-size:\s*0;/);
  assert.match(colorChipCss, /color:\s*transparent;/);
  assert.match(activeChipCss, /border-color:\s*rgba\(141, 63, 93, 0\.78\);/);
  assert.match(addCss, /\.familyTimetableColorChipDisabled,\s*\.familyTimetableColorChip:disabled\s*\{[\s\S]*opacity:\s*0\.38;/);
  assert.match(addCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableColorChips\s*\{[\s\S]*grid-template-columns:\s*repeat\(6, 42px\);/);
});

test("family timetable color uniqueness and copy pills remain", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const copyPillsCss = cssBlock(addCss, ".familyTimetableCopyPills");
  const copyPillCss = cssBlock(addCss, ".familyTimetableCopyPill");

  assert.match(timetableSource, /function getUsedScheduleColors\(entries, editingEntryId = null\)/);
  assert.match(timetableSource, /function getFirstAvailableColor\(usedColors, preferredColor = "pink"\)/);
  assert.match(timetableSource, /function colorIsUnavailable\(color\)/);
  assert.match(timetableSource, /usedEditorColors\.has\(color\) && editorDraft\.color !== color && hasAvailableColor\(usedEditorColors\)/);
  assert.match(timetableSource, /if \(saveUsedColors\.has\(selectedColor\) && hasAvailableColor\(saveUsedColors\)\) \{/);
  assert.match(timetableSource, /editorDraft\.isNew && visibleEntries\.length > 0/);
  assert.match(timetableSource, /onClick=\{\(\) => copyEntryToNewDraft\(entry\)\}/);
  assert.match(timetableSource, /복사해서 만들기/);
  assert.match(copyPillsCss, /display:\s*flex;/);
  assert.match(copyPillsCss, /overflow-x:\s*auto;/);
  assert.match(copyPillCss, /flex:\s*0 0 auto;/);

  for (const dayLabel of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableScroller\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*grid-template-columns:\s*24px repeat\(7, minmax\(0, 1fr\)\);/);
});
