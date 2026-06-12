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
  assert.match(timetableSource, /function createNewScheduleDraft\(color = "pink"\)/);
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
  assert.match(timetableSource, /if \(start < earliest \|\| start >= latest \|\| end <= start \|\| end > latest\) \{/);
  assert.match(timetableSource, /const \{ slots, error: slotError \} = normalizeEditorSlots\(editorDraft\.slots\);/);
  assert.match(timetableSource, /setEditorError\(slotError\);/);
  assert.match(timetableSource, /return \{ error: "시간을 하나 이상 추가해주세요\.", slots: \[\] \};/);
});

test("family timetable keeps legacy recovery while storing grouped slots", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
  assert.match(timetableSource, /function normalizeDayOfWeek\(dayOfWeek\)/);
  assert.match(timetableSource, /return isValidDayOfWeek\(value\) \? value : 1;/);
  assert.match(timetableSource, /function normalizeTimetableSlot\(slot\)/);
  assert.match(timetableSource, /function slotsFromEntry\(entry\)/);
  assert.match(timetableSource, /Array\.isArray\(entry\?\.slots\) && entry\.slots\.length > 0/);
  assert.match(timetableSource, /dayOfWeek:\s*entry\?\.dayOfWeek/);
  assert.match(timetableSource, /startTime:\s*entry\?\.startTime/);
  assert.match(timetableSource, /endTime:\s*entry\?\.endTime/);
  assert.match(timetableSource, /slots,/);
  assert.match(timetableSource, /dayOfWeek:\s*firstSlot\.dayOfWeek/);
  assert.match(timetableSource, /startTime:\s*firstSlot\.startTime/);
  assert.match(timetableSource, /endTime:\s*firstSlot\.endTime/);
});

test("family timetable time-slot rows are compact aligned grids", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const slotRowCss = cssBlock(addCss, ".familyTimetableSlotRow");
  const removeButtonCss = cssBlock(addCss, ".familyTimetableSlotRemove");

  assert.match(timetableSource, /editorDraft\.slots\.map\(\(slot, slotIndex\) =>/);
  assert.match(timetableSource, /className="familyTimetableSlotRow"/);
  assert.match(timetableSource, />\s*\+ 시간 추가\s*<\/button>/);
  assert.match(timetableSource, /disabled=\{editorDraft\.slots\.length <= 1\}/);
  assert.match(timetableSource, /aria-label="시간 삭제"/);
  assert.match(timetableSource, /updateEditorSlot\(slotIndex, "dayOfWeek", event\.target\.value\)/);
  assert.match(timetableSource, /updateEditorSlot\(slotIndex, "startTime", event\.target\.value\)/);
  assert.match(timetableSource, /updateEditorSlot\(slotIndex, "endTime", event\.target\.value\)/);

  assert.match(slotRowCss, /display:\s*grid;/);
  assert.match(slotRowCss, /grid-template-columns:\s*minmax\(88px, 1fr\) minmax\(82px, 0\.8fr\) minmax\(82px, 0\.8fr\) 36px;/);
  assert.match(slotRowCss, /align-items:\s*end;/);
  assert.match(slotRowCss, /gap:\s*8px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\]\s*\{[\s\S]*min-width:\s*0;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\]\s*\{[\s\S]*height:\s*42px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\]\s*\{[\s\S]*font-size:\s*16px;/);
  assert.match(addCss, /@media \(max-width: 640px\) \{[\s\S]*grid-template-columns:\s*minmax\(70px, 1fr\) minmax\(74px, 0\.85fr\) minmax\(74px, 0\.85fr\) 36px;/);
  assert.match(removeButtonCss, /align-self:\s*end;/);
  assert.match(removeButtonCss, /width:\s*36px;/);
});

test("family timetable enforces one available color per schedule", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  for (const color of ["pink", "rose", "peach", "yellow", "mint", "green", "sky", "blue", "lavender", "purple", "cream", "gray"]) {
    assert.match(timetableSource, new RegExp(`"${color}"`));
  }

  assert.match(timetableSource, /function getUsedScheduleColors\(entries, editingEntryId = null\)/);
  assert.match(timetableSource, /entry\.id !== editingEntryId/);
  assert.match(timetableSource, /function getFirstAvailableColor\(usedColors, preferredColor = "pink"\)/);
  assert.match(timetableSource, /function hasAvailableColor\(usedColors\)/);
  assert.match(timetableSource, /const \[colorNotice, setColorNotice\] = useState\(""\);/);
  assert.match(timetableSource, /const usedEditorColors = useMemo/);
  assert.match(timetableSource, /function colorIsUnavailable\(color\)/);
  assert.match(timetableSource, /usedEditorColors\.has\(color\) && editorDraft\.color !== color && hasAvailableColor\(usedEditorColors\)/);
  assert.match(timetableSource, /createNewScheduleDraft\(getFirstAvailableColor\(usedColors, "pink"\)\)/);
  assert.match(timetableSource, /function entryToNewDraft\(entry, usedColors = new Set\(\)\)/);
  assert.match(timetableSource, /color:\s*getFirstAvailableColor\(usedColors, entry\.color\)/);
  assert.match(timetableSource, /copiedDraft\.color !== copiedColor/);
  assert.match(timetableSource, /이미 사용 중인 색상이라 다른 색상을 골랐어요\./);
  assert.match(timetableSource, /이미 사용 중인 색상은 선택할 수 없어요\./);
  assert.match(timetableSource, /const saveUsedColors = getUsedScheduleColors\(entries, editorDraft\.isNew \? null : editingEntryId\);/);
  assert.match(timetableSource, /if \(saveUsedColors\.has\(selectedColor\) && hasAvailableColor\(saveUsedColors\)\) \{/);
  assert.match(timetableSource, /setEditorDraft\(\(current\) => \(\{ \.\.\.current, color: nextColor \}\)\);/);
  assert.match(timetableSource, /disabled=\{unavailable\}/);
  assert.match(timetableSource, /familyTimetableColorChipDisabled/);
  assert.match(timetableSource, /<p className="familyTimetableColorHelp">\{colorNotice\}<\/p>/);

  assert.match(addCss, /\.familyTimetableColorChipDisabled,\s*\.familyTimetableColorChip:disabled\s*\{[\s\S]*opacity:\s*0\.38;/);
  assert.match(addCss, /\.familyTimetableColorHelp\s*\{[\s\S]*font-size:\s*11px;/);
});

test("family timetable copy pills and mobile rules remain", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const copyPillsCss = cssBlock(addCss, ".familyTimetableCopyPills");
  const copyPillCss = cssBlock(addCss, ".familyTimetableCopyPill");

  assert.match(timetableSource, /editorDraft\.isNew && visibleEntries\.length > 0/);
  assert.match(timetableSource, /복사해서 만들기/);
  assert.match(timetableSource, /onClick=\{\(\) => copyEntryToNewDraft\(entry\)\}/);
  assert.match(timetableSource, /\{entry\.title\}/);
  assert.match(copyPillsCss, /display:\s*flex;/);
  assert.match(copyPillsCss, /overflow-x:\s*auto;/);
  assert.match(copyPillCss, /flex:\s*0 0 auto;/);
  assert.match(copyPillCss, /text-overflow:\s*ellipsis;/);

  for (const dayLabel of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }
  assert.match(timetableSource, /familyTimetableHourCompact/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableScroller\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*grid-template-columns:\s*24px repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableEntryTime\s*\{[\s\S]*display:\s*none;/);
});
