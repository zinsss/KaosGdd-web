import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
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
  assert.match(timetableSource, /if \(editorDraft\.isNew\) \{/);
  assert.match(timetableSource, /setEntries\(\(current\) => sortTimetableEntries\(\[\.\.\.current, nextEntry\]\)\)/);

  for (const fieldPattern of [
    /id:\s*createId\(\)/,
    /title,/,
    /dayOfWeek:\s*Number\(editorDraft\.dayOfWeek\)/,
    /startTime:\s*minutesToTime\(start\)/,
    /endTime:\s*minutesToTime\(Math\.min\(TIMETABLE_END_HOUR \* 60, end\)\)/,
    /memo:\s*editorDraft\.memo/,
    /color:\s*FAMILY_TIMETABLE_COLORS\.includes\(editorDraft\.color\) \? editorDraft\.color : "pink"/,
    /active:\s*true/,
    /createdAt:\s*now/,
    /updatedAt:\s*now/,
  ]) {
    assert.match(timetableSource, fieldPattern);
  }

  for (const label of ["일정 이름", "요일", "시작", "끝", "메모", "색상", "저장", "취소", "삭제"]) {
    assert.match(timetableSource, new RegExp(label));
  }

  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
});

test("family timetable editor uses fixed pastel color chips", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const colorChipCss = cssBlock(addCss, ".familyTimetableColorChip");
  const activeChipCss = cssBlock(addCss, ".familyTimetableColorChipActive");
  const colorChipsCss = cssBlock(addCss, ".familyTimetableColorChips");

  assert.match(timetableSource, /FAMILY_TIMETABLE_COLORS = \["pink", "cream", "yellow", "mint", "blue", "lavender"\]/);
  assert.match(timetableSource, /FAMILY_TIMETABLE_COLOR_LABELS = \{/);
  for (const label of ["분홍", "크림", "노랑", "민트", "하늘", "보라"]) {
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
    "familyTimetableEntryCream",
    "familyTimetableEntryYellow",
    "familyTimetableEntryMint",
    "familyTimetableEntryBlue",
    "familyTimetableEntryLavender",
  ]) {
    assert.match(familyCss, new RegExp(`\\.${className}\\s*\\{`));
  }

  assert.match(colorChipsCss, /display:\s*flex;/);
  assert.match(colorChipsCss, /flex-wrap:\s*wrap;/);
  assert.match(colorChipCss, /min-height:\s*34px;/);
  assert.match(colorChipCss, /border-radius:\s*999px;/);
  assert.match(activeChipCss, /border-color:\s*rgba\(141, 63, 93, 0\.64\);/);
  assert.match(addCss, /\.familyTimetableColorChipPink\s*\{/);
  assert.match(addCss, /\.familyTimetableColorChipCream\s*\{/);
  assert.match(addCss, /\.familyTimetableColorChipYellow\s*\{/);
  assert.match(addCss, /\.familyTimetableColorChipMint\s*\{/);
  assert.match(addCss, /\.familyTimetableColorChipBlue\s*\{/);
  assert.match(addCss, /\.familyTimetableColorChipLavender\s*\{/);
});

test("family timetable editor keeps day and time controls compact", async () => {
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const editorGridCss = cssBlock(addCss, ".familyTimetableEditorGrid");

  assert.match(editorGridCss, /display:\s*flex;/);
  assert.match(editorGridCss, /flex-wrap:\s*wrap;/);
  assert.match(editorGridCss, /gap:\s*10px;/);
  assert.match(addCss, /\.familyTimetableEditorGrid label:nth-child\(1\)\s*\{[\s\S]*max-width:\s*120px;/);
  assert.match(addCss, /\.familyTimetableEditorGrid label:nth-child\(2\),\s*\.familyTimetableEditorGrid label:nth-child\(3\)\s*\{[\s\S]*max-width:\s*110px;/);
  assert.match(addCss, /\.familyTimetableEditorGrid select,\s*\.familyTimetableEditorGrid input\[type="time"\]\s*\{[\s\S]*width:\s*100%;/);
  assert.match(addCss, /@media \(max-width: 640px\) \{[\s\S]*\.familyTimetableEditorGrid\s*\{[\s\S]*flex-wrap:\s*wrap;/);
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
