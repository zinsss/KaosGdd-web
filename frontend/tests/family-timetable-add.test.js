import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\s*\{[^}]*\}`));
  return match ? match[0] : "";
}

test("family timetable has a visible add schedule editor path", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const addButtonCss = cssBlock(addCss, ".familyTimetableAddButton");
  const introActionsCss = cssBlock(addCss, ".familyTimetableIntroActions");
  const editorErrorCss = cssBlock(addCss, ".familyTimetableEditorError");

  assert.match(globalsCss, /@import "\.\/styles\/family-timetable-add\.css";/);
  assert.match(timetableSource, /familyTimetableAddButton/);
  assert.match(timetableSource, />\s*\+ 일정\s*<\/button>/);
  assert.match(timetableSource, /onClick=\{startNewEntry\}/);
  assert.match(timetableSource, /function startNewEntry\(\)/);
  assert.match(timetableSource, /setEditorDraft\(createNewScheduleDraft\(\)\)/);
  assert.match(timetableSource, /requestAnimationFrame\(\(\) => titleInputRef\.current\?\.focus\(\)\)/);
  assert.match(timetableSource, /function createNewScheduleDraft\(\)/);
  assert.match(timetableSource, /function getTodayDayOfWeek\(\)/);
  assert.match(timetableSource, /function getDefaultStartMinutes\(\)/);
  assert.match(timetableSource, /const fallback = 9 \* 60;/);
  assert.match(timetableSource, /dayOfWeek:\s*String\(getTodayDayOfWeek\(\)\)/);
  assert.match(timetableSource, /title:\s*""/);
  assert.match(timetableSource, /color:\s*"pink"/);
  assert.match(timetableSource, /active:\s*true/);
  assert.match(timetableSource, /isNew:\s*true/);

  assert.match(introActionsCss, /display:\s*inline-flex;/);
  assert.match(addButtonCss, /background:\s*#d86f98;/);
  assert.match(addButtonCss, /font-size:\s*15px;/);
  assert.match(addButtonCss, /white-space:\s*nowrap;/);
  assert.match(addCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableIntroActions\s*\{[\s\S]*width:\s*100%;/);
  assert.match(addCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableAddButton\s*\{[\s\S]*min-height:\s*38px;/);
  assert.match(editorErrorCss, /color:\s*#9d3657;/);
});

test("family timetable disables empty-cell add behavior", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const slotCss = cssBlock(addCss, ".familyTimetableSlot");

  assert.match(timetableSource, /<span\s+className="familyTimetableSlot"/);
  assert.match(timetableSource, /aria-hidden="true"/);
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.doesNotMatch(timetableSource, /onClick=\{\(\) => addTimetableEntry/);
  assert.match(slotCss, /pointer-events:\s*none;/);
});

test("family timetable add save rejects blank titles and stores structured records", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");

  assert.match(timetableSource, /const title = editorDraft\.title\.trim\(\);/);
  assert.match(timetableSource, /if \(!title\) \{/);
  assert.match(timetableSource, /setEditorError\("일정 이름을 입력해주세요\."\);/);
  assert.match(timetableSource, /role="alert"/);
  assert.match(timetableSource, /일정 이름을 입력해주세요\./);
  assert.match(timetableSource, /if \(field === "title" && value\.trim\(\)\) \{/);
  assert.match(timetableSource, /const slots = normalizeEditorSlots\(editorDraft\.slots\);/);
  assert.match(timetableSource, /if \(slots\.length === 0\) \{/);
  assert.match(timetableSource, /setEditorError\("시간을 하나 이상 추가해주세요\."\);/);
  assert.match(timetableSource, /if \(editorDraft\.isNew\) \{/);
  assert.match(timetableSource, /setEntries\(\(current\) => sortTimetableEntries\(\[\.\.\.current, nextEntry\]\)\)/);

  for (const fieldPattern of [
    /id:\s*createId\(\)/,
    /title,/,
    /slots,/,
    /dayOfWeek:\s*firstSlot\.dayOfWeek/,
    /startTime:\s*firstSlot\.startTime/,
    /endTime:\s*firstSlot\.endTime/,
    /memo:\s*editorDraft\.memo/,
    /color:\s*normalizeTimetableColor\(editorDraft\.color\)/,
    /active:\s*editorDraft\.active !== false/,
    /createdAt:\s*now/,
    /updatedAt:\s*now/,
  ]) {
    assert.match(timetableSource, fieldPattern);
  }

  for (const label of ["일정 이름", "시간", "요일", "시작", "끝", "+ 시간 추가", "메모", "색상", "저장", "취소", "삭제"]) {
    assert.match(timetableSource, new RegExp(label.replace("+", "\\+")));
  }

  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
});

test("family timetable editor supports multiple compact time slots", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const slotFieldCss = cssBlock(addCss, ".familyTimetableSlotField");
  const slotRowsCss = cssBlock(addCss, ".familyTimetableSlotRows");
  const slotRowCss = cssBlock(addCss, ".familyTimetableSlotRow");
  const addSlotButtonCss = cssBlock(addCss, ".familyTimetableAddSlotButton");
  const removeButtonCss = cssBlock(addCss, ".familyTimetableSlotRemove");

  assert.match(timetableSource, /function normalizeTimetableSlot\(slot\)/);
  assert.match(timetableSource, /function createDefaultSlot\(\{ dayOfWeek, startMinutes \}\)/);
  assert.match(timetableSource, /function slotsFromEntry\(entry\)/);
  assert.match(timetableSource, /slots:\s*\[slot\]/);
  assert.match(timetableSource, /slots:\s*entry\.slots\.map/);
  assert.match(timetableSource, /function updateEditorSlot\(slotIndex, field, value\)/);
  assert.match(timetableSource, /function addEditorSlot\(\)/);
  assert.match(timetableSource, /function removeEditorSlot\(slotIndex\)/);
  assert.match(timetableSource, /editorDraft\.slots\.map\(\(slot, slotIndex\) =>/);
  assert.match(timetableSource, /className="familyTimetableSlotRows"/);
  assert.match(timetableSource, /className="familyTimetableSlotRow"/);
  assert.match(timetableSource, /className="familyTimetableAddSlotButton"/);
  assert.match(timetableSource, /className="familyTimetableSlotRemove"/);
  assert.match(timetableSource, />\s*\+ 시간 추가\s*<\/button>/);
  assert.match(timetableSource, /disabled=\{editorDraft\.slots\.length <= 1\}/);
  assert.match(timetableSource, /aria-label="시간 삭제"/);
  assert.match(timetableSource, /updateEditorSlot\(slotIndex, "dayOfWeek", event\.target\.value\)/);
  assert.match(timetableSource, /updateEditorSlot\(slotIndex, "startTime", event\.target\.value\)/);
  assert.match(timetableSource, /updateEditorSlot\(slotIndex, "endTime", event\.target\.value\)/);
  assert.match(timetableSource, /onClick=\{addEditorSlot\}/);
  assert.match(timetableSource, /onClick=\{\(\) => removeEditorSlot\(slotIndex\)\}/);

  assert.match(slotFieldCss, /display:\s*grid;/);
  assert.match(slotRowsCss, /display:\s*grid;/);
  assert.match(slotRowCss, /display:\s*flex;/);
  assert.match(slotRowCss, /flex-wrap:\s*wrap;/);
  assert.match(slotRowCss, /gap:\s*10px;/);
  assert.match(addCss, /\.familyTimetableSlotRow label:nth-child\(1\)\s*\{[\s\S]*max-width:\s*120px;/);
  assert.match(addCss, /\.familyTimetableSlotRow label:nth-child\(2\),\s*\.familyTimetableSlotRow label:nth-child\(3\)\s*\{[\s\S]*max-width:\s*110px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\]\s*\{[\s\S]*width:\s*100%;/);
  assert.match(addSlotButtonCss, /justify-self:\s*start;/);
  assert.match(removeButtonCss, /width:\s*34px;/);
});

test("family timetable new editor can prefill from existing schedules", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const copyPillsCss = cssBlock(addCss, ".familyTimetableCopyPills");
  const copyPillCss = cssBlock(addCss, ".familyTimetableCopyPill");

  assert.match(timetableSource, /function entryToNewDraft\(entry\)/);
  assert.match(timetableSource, /id:\s*""/);
  assert.match(timetableSource, /title:\s*entry\.title/);
  assert.match(timetableSource, /const slots = entry\.slots\.map/);
  assert.match(timetableSource, /dayOfWeek:\s*firstSlot\.dayOfWeek/);
  assert.match(timetableSource, /startTime:\s*firstSlot\.startTime/);
  assert.match(timetableSource, /endTime:\s*firstSlot\.endTime/);
  assert.match(timetableSource, /memo:\s*entry\.memo \|\| ""/);
  assert.match(timetableSource, /color:\s*normalizeTimetableColor\(entry\.color\)/);
  assert.match(timetableSource, /active:\s*entry\.active !== false/);
  assert.match(timetableSource, /isNew:\s*true/);
  assert.match(timetableSource, /function copyEntryToNewDraft\(entry\)/);
  assert.match(timetableSource, /setEditorDraft\(entryToNewDraft\(entry\)\)/);
  assert.match(timetableSource, /editorDraft\.isNew && visibleEntries\.length > 0/);
  assert.match(timetableSource, /복사해서 만들기/);
  assert.match(timetableSource, /familyTimetableCopyPills/);
  assert.match(timetableSource, /familyTimetableCopyPill/);
  assert.match(timetableSource, /onClick=\{\(\) => copyEntryToNewDraft\(entry\)\}/);
  assert.match(timetableSource, /\{entry\.title\}/);
  assert.doesNotMatch(timetableSource, /!editorDraft\.isNew[\s\S]*familyTimetableCopyPills/);

  assert.match(copyPillsCss, /display:\s*flex;/);
  assert.match(copyPillsCss, /overflow-x:\s*auto;/);
  assert.match(copyPillCss, /flex:\s*0 0 auto;/);
  assert.match(copyPillCss, /text-overflow:\s*ellipsis;/);
});

test("family timetable editor uses fixed pastel color chips", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const colorChipCss = cssBlock(addCss, ".familyTimetableColorChip");
  const activeChipCss = cssBlock(addCss, ".familyTimetableColorChipActive");
  const colorChipsCss = cssBlock(addCss, ".familyTimetableColorChips");

  for (const color of ["pink", "rose", "peach", "yellow", "mint", "green", "sky", "blue", "lavender", "purple", "cream", "gray"]) {
    assert.match(timetableSource, new RegExp(`"${color}"`));
  }
  assert.match(timetableSource, /function normalizeTimetableColor\(color, fallback = "pink"\)/);
  assert.match(timetableSource, /return FAMILY_TIMETABLE_COLORS\.includes\(color\) \? color : fallback;/);
  assert.match(timetableSource, /function colorClassName\(color\)/);
  assert.match(timetableSource, /FAMILY_TIMETABLE_COLOR_LABELS = \{/);
  for (const label of ["분홍", "장미", "복숭아", "노랑", "민트", "초록", "하늘", "파랑", "라벤더", "보라", "크림", "회색"]) {
    assert.match(timetableSource, new RegExp(label));
  }
  assert.match(timetableSource, /<span>색상<\/span>/);
  assert.match(timetableSource, /familyTimetableColorChips/);
  assert.match(timetableSource, /role="radiogroup"/);
  assert.match(timetableSource, /aria-label="색상"/);
  assert.match(timetableSource, /familyTimetableColorChipActive/);
  assert.match(timetableSource, /aria-pressed=\{editorDraft\.color === color\}/);
  assert.match(timetableSource, /onClick=\{\(\) => updateEditorDraft\("color", color\)\}/);
  assert.match(timetableSource, /\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.doesNotMatch(timetableSource, /<select value=\{editorDraft\.color\}/);

  for (const className of [
    "familyTimetableEntryPink",
    "familyTimetableEntryRose",
    "familyTimetableEntryPeach",
    "familyTimetableEntryYellow",
    "familyTimetableEntryMint",
    "familyTimetableEntryGreen",
    "familyTimetableEntrySky",
    "familyTimetableEntryBlue",
    "familyTimetableEntryLavender",
    "familyTimetableEntryPurple",
    "familyTimetableEntryCream",
    "familyTimetableEntryGray",
  ]) {
    assert.match(addCss, new RegExp(`\\.${className}\\s*,|\\.${className}\\s*\\{`));
  }

  assert.match(colorChipsCss, /display:\s*flex;/);
  assert.match(colorChipsCss, /flex-wrap:\s*wrap;/);
  assert.match(colorChipCss, /min-height:\s*34px;/);
  assert.match(colorChipCss, /border-radius:\s*999px;/);
  assert.match(activeChipCss, /border-color:\s*rgba\(141, 63, 93, 0\.64\);/);
});

test("family timetable editor keeps day and time controls compact", async () => {
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const slotRowCss = cssBlock(addCss, ".familyTimetableSlotRow");

  assert.match(slotRowCss, /display:\s*flex;/);
  assert.match(slotRowCss, /flex-wrap:\s*wrap;/);
  assert.match(slotRowCss, /gap:\s*10px;/);
  assert.match(addCss, /\.familyTimetableSlotRow label:nth-child\(1\)\s*\{[\s\S]*max-width:\s*120px;/);
  assert.match(addCss, /\.familyTimetableSlotRow label:nth-child\(2\),\s*\.familyTimetableSlotRow label:nth-child\(3\)\s*\{[\s\S]*max-width:\s*110px;/);
  assert.match(addCss, /\.familyTimetableSlotRow select,\s*\.familyTimetableSlotRow input\[type="time"\]\s*\{[\s\S]*width:\s*100%;/);
  assert.match(addCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableSlotRow\s*\{[\s\S]*flex-wrap:\s*wrap;/);
});

test("family timetable add UX preserves compact mobile timetable rules", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  for (const dayLabel of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }

  assert.match(timetableSource, /familyTimetableHourCompact/);
  assert.match(timetableSource, /<span className="familyTimetableHourCompact">\{hour\}<\/span>/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableScroller\s*\{[\s\S]*overflow-x:\s*hidden;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*grid-template-columns:\s*24px repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableEntryTime\s*\{[\s\S]*display:\s*none;/);
});
