import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const requestedSelectors = selector.split(",").map((value) => value.trim()).filter(Boolean);
  const blocks = [];
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of source.matchAll(blockPattern)) {
    const blockSelectors = match[1].split(",").map((value) => value.trim());
    if (requestedSelectors.every((requestedSelector) => blockSelectors.includes(requestedSelector))) {
      blocks.push(`${match[1]}{${match[2]}}`);
    }
  }

  return blocks.join("\n");
}

test("family page route exposes a Korean quick pad shell", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const topNavSource = await readFile(new URL("../components/TopNav.js" , import.meta.url), "utf8");

  assert.match(pageSource, /FamilyPageClient/);
  assert.match(clientSource, /가족 메모/);
  assert.match(clientSource, /가족 메모를 남겨요/);
  assert.match(clientSource, /체크리스트 모드/);
  assert.match(clientSource, /parseChecklistInput/);
  assert.match(clientSource, /title:\s*lines\[0\]/);
  assert.match(clientSource, /items:\s*lines\.slice\(1\)/);
  assert.match(clientSource, /☐/);
  assert.match(clientSource, /☑/);
  assert.doesNotMatch(`${clientSource}\n${timetableSource}`.toLowerCase(), /therapy/);
  assert.doesNotMatch(topNavSource, /\/family/);
  assert.match(globalsCss, /@import "\.\/styles\/family\.css";/);
  assert.match(familyCss, /\.familyPage\s*\{/);
  assert.match(familyCss, /#ffd8e5/);
});

test("family composer avoids iOS zoom and resets textarea height after send", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const familyInputCss = cssBlock(familyCss, ".familyInput");
  const familyComposerButtonCss = cssBlock(familyCss, ".familyChecklistToggle,\n.familySend,\n.familyCancel");

  assert.match(familyInputCss, /font-size:\s*16px;/);
  assert.match(familyComposerButtonCss, /font-size:\s*16px;/);
  assert.match(clientSource, /useRef/);
  assert.match(clientSource, /const inputRef = useRef\(null\);/);
  assert.match(clientSource, /function resetInputHeight\(\)/);
  assert.match(clientSource, /el\.style\.height = "";/);
  assert.match(clientSource, /function resizeInputToContent/);
  assert.match(clientSource, /Math\.min\(el\.scrollHeight, 148\)/);
  assert.match(clientSource, /rows=\{checklistMode \? 4 : 1\}/);
  assert.match(clientSource, /onChange=\{handleDraftChange\}/);
  assert.match(clientSource, /requestAnimationFrame\(resetInputHeight\)/);
});

test("family default timetable uses a local weekly template model", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const topNavSource = await readFile(new URL("../components/TopNav.js", import.meta.url), "utf8");

  assert.match(clientSource, /메모/);
  assert.match(clientSource, /기본 시간표/);
  assert.match(clientSource, /familyMode/);
  assert.match(clientSource, /setFamilyMode\("memo"\)/);
  assert.match(clientSource, /setFamilyMode\("timetable"\)/);
  assert.match(clientSource, /<FamilyTimetable \/>/);
  assert.doesNotMatch(topNavSource, /\/family/);

  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
  assert.match(timetableSource, /TIMETABLE_START_HOUR = 8/);
  assert.match(timetableSource, /TIMETABLE_END_HOUR = 22/);
  assert.match(timetableSource, /TIMETABLE_SLOT_MINUTES = 10/);
  assert.match(timetableSource, /DEFAULT_TIMETABLE_DURATION_MINUTES = 40/);
  for (const color of ["pink", "rose", "peach", "yellow", "mint", "green", "sky", "blue", "lavender", "purple", "cream", "gray"]) {
    assert.match(timetableSource, new RegExp(`"${color}"`));
  }
  assert.match(timetableSource, /DAY_LABELS = \[/);
  for (const dayLabel of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }
  assert.match(timetableSource, /TIMETABLE_HOURS/);
  assert.match(timetableSource, /TIMETABLE_VISIBLE_HOURS/);
  assert.match(timetableSource, /familyTimetableHourLabel/);
  assert.match(timetableSource, /familyTimetableSlot/);

  assert.match(timetableSource, /function timeToMinutes\(timeString\)/);
  assert.match(timetableSource, /function minutesToTime\(totalMinutes\)/);
  assert.match(timetableSource, /function snapMinutes\(totalMinutes\)/);
  assert.match(timetableSource, /function createDefaultTimetableEntry/);
  assert.match(timetableSource, /id:\s*createId\(\)/);
  assert.match(timetableSource, /title:\s*title\.trim\(\) \|\| "새 일정"/);
  assert.match(timetableSource, /dayOfWeek,/);
  assert.match(timetableSource, /startTime:\s*minutesToTime\(start\)/);
  assert.match(timetableSource, /endTime:\s*minutesToTime\(end\)/);
  assert.match(timetableSource, /memo:\s*""/);
  assert.match(timetableSource, /color:\s*"pink"/);
  assert.match(timetableSource, /active:\s*true/);
  assert.match(timetableSource, /createdAt:\s*now/);
  assert.match(timetableSource, /updatedAt:\s*now/);
  assert.match(timetableSource, /window\.localStorage\.getItem\(FAMILY_TIMETABLE_STORAGE_KEY\)/);
  assert.match(timetableSource, /window\.localStorage\.setItem\(FAMILY_TIMETABLE_STORAGE_KEY, JSON\.stringify\(entries\)\)/);
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
  assert.doesNotMatch(timetableSource, /onClick=\{\(\) => addTimetableEntry/);
  assert.match(timetableSource, /<span\s+className="familyTimetableSlot"/);
  assert.match(timetableSource, /aria-hidden="true"/);
  assert.match(timetableSource, /function startEditEntry\(entry\)/);
  assert.match(timetableSource, /function saveEditingEntry\(\)/);
  assert.match(timetableSource, /function deleteTimetableEntry/);
  assert.match(timetableSource, /window\.confirm\("삭제할까요\?"\)/);
  assert.match(timetableSource, /active !== false/);
  assert.doesNotMatch(timetableSource, /draggable|dragstart|dragover|drop/);

  assert.match(familyCss, /\.familyModeSwitch\s*\{/);
  assert.match(familyCss, /\.familyTimetable\s*\{/);
  assert.match(familyCss, /\.familyTimetableGrid\s*\{/);
  assert.match(familyCss, /\.familyTimetableHourLabel\s*\{/);
  assert.match(familyCss, /\.familyTimetableSlot\s*\{/);
  assert.match(familyCss, /\.familyTimetableEditor\s*\{/);
});

test("family timetable uses compact no-scroll mobile layout", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(timetableSource, /familyTimetableHourFull/);
  assert.match(timetableSource, /familyTimetableHourCompact/);
  assert.match(timetableSource, /<span className="familyTimetableHourCompact">\{hour\}<\/span>/);
  assert.match(timetableSource, /<span className="familyTimetableHourFull">\{minutesToTime\(hour \* 60\)\}<\/span>/);
  for (const dayLabel of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }

  assert.match(familyCss, /\.familyTimetableHourCompact\s*\{\s*display:\s*none;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTimetableScroller\s*\{[\s\S]*?overflow-x:\s*hidden;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTimetableGrid\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*?grid-template-columns:\s*24px repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTimetableHourFull\s*\{[\s\S]*?display:\s*none;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTimetableHourCompact\s*\{[\s\S]*?display:\s*inline;/);
  assert.match(familyCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTimetableEntryTime\s*\{[\s\S]*?display:\s*none;/);
});

test("family scrollable areas use pastel family scrollbars", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyPage,\s*\.familyStream,\s*\.familyTimetableScroller,\s*\.familyInput,\s*\.familyTimetableEditor textarea\s*\{[\s\S]*?scrollbar-color:\s*rgba\(214, 128, 157, 0\.58\) rgba\(255, 248, 251, 0\.76\);/);
  assert.match(familyCss, /\.familyInput::-webkit-scrollbar[\s\S]*?\{[\s\S]*?width:\s*8px;/);
  assert.match(familyCss, /\.familyInput::-webkit-scrollbar-track[\s\S]*?\{[\s\S]*?background:\s*rgba\(255, 248, 251, 0\.76\);/);
  assert.match(familyCss, /\.familyInput::-webkit-scrollbar-thumb[\s\S]*?\{[\s\S]*?background:\s*rgba\(214, 128, 157, 0\.58\);/);
  assert.match(familyCss, /\.familyInput::-webkit-scrollbar-thumb:hover[\s\S]*?\{[\s\S]*?background:\s*rgba\(180, 92, 125, 0\.72\);/);
  assert.match(familyCss, /\.familyStream::-webkit-scrollbar-thumb[\s\S]*?\{[\s\S]*?background:\s*rgba\(214, 128, 157, 0\.58\);/);
  assert.match(familyCss, /\.familyTimetableScroller::-webkit-scrollbar-thumb[\s\S]*?\{[\s\S]*?background:\s*rgba\(214, 128, 157, 0\.58\);/);
  assert.match(familyCss, /\.familyPage::-webkit-scrollbar-track[\s\S]*?\{[\s\S]*?background:\s*rgba\(255, 248, 251, 0\.76\);/);
  assert.match(familyCss, /background:\s*rgba\(214, 128, 157, 0\.58\);/);
  assert.match(familyCss, /background:\s*rgba\(180, 92, 125, 0\.72\);/);
  assert.doesNotMatch(baseCss, /familyInput|214, 128, 157|255, 248, 251/);
  assert.doesNotMatch(shellCss, /familyInput|214, 128, 157|255, 248, 251/);
});

test("family bubbles keep edit control in the footer with time", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const bubbleRowCss = cssBlock(familyCss, ".familyBubbleRow");
  const bubbleCss = cssBlock(familyCss, ".familyBubble");
  const bubbleFooterCss = cssBlock(familyCss, ".familyBubbleFooter");
  const bubbleTimeCss = cssBlock(familyCss, ".familyBubbleTime");
  const deleteIconCss = cssBlock(familyCss, ".familyBubbleDeleteIcon");
  const editIconCss = cssBlock(familyCss, ".familyBubbleEditIcon");

  assert.match(clientSource, /familyBubbleRow/);
  assert.match(clientSource, /familyBubbleContent/);
  assert.match(clientSource, /familyBubbleFooter/);
  assert.match(clientSource, /familyBubbleDeleteIcon/);
  assert.match(clientSource, /familyBubbleEditIcon/);
  assert.match(clientSource, />\s*×\s*<\/button>/);
  assert.match(clientSource, />\s*✎\s*<\/button>/);
  assert.match(clientSource, /<div className="familyBubbleFooter">\s*<time className="familyBubbleTime">\{message\.createdAt\}<\/time>\s*<button className="familyBubbleEditIcon"/);
  assert.doesNotMatch(clientSource, /familyBubbleActions/);
  assert.doesNotMatch(clientSource, />\s*수정\s*<\/button>/);
  assert.match(bubbleRowCss, /width:\s*100%;/);
  assert.match(bubbleCss, /position:\s*relative;/);
  assert.match(bubbleCss, /width:\s*100%;/);
  assert.match(bubbleCss, /max-width:\s*none;/);
  assert.match(bubbleCss, /padding:\s*10px 38px 8px 12px;/);
  assert.match(bubbleFooterCss, /display:\s*flex;/);
  assert.match(bubbleFooterCss, /justify-content:\s*flex-end;/);
  assert.match(bubbleFooterCss, /flex-wrap:\s*nowrap;/);
  assert.match(bubbleFooterCss, /gap:\s*8px;/);
  assert.match(bubbleFooterCss, /white-space:\s*nowrap;/);
  assert.match(bubbleTimeCss, /display:\s*inline-flex;/);
  assert.match(bubbleTimeCss, /flex:\s*0 0 auto;/);
  assert.match(bubbleTimeCss, /font-size:\s*0\.76rem;/);
  assert.match(bubbleTimeCss, /line-height:\s*1;/);
  assert.match(bubbleTimeCss, /white-space:\s*nowrap;/);
  assert.doesNotMatch(bubbleTimeCss, /display:\s*block;/);
  assert.match(deleteIconCss, /position:\s*absolute;/);
  assert.match(deleteIconCss, /right:\s*8px;/);
  assert.match(deleteIconCss, /top:\s*7px;/);
  assert.match(editIconCss, /position:\s*static;/);
  assert.match(editIconCss, /flex:\s*0 0 auto;/);
  assert.doesNotMatch(editIconCss, /position:\s*absolute;/);
  assert.doesNotMatch(editIconCss, /bottom:\s*7px;/);
  assert.doesNotMatch(familyCss, /\.familyBubbleActions/);
  assert.doesNotMatch(familyCss, /grid-template-columns:\s*minmax\(0, 1fr\) 24px;/);
  assert.doesNotMatch(familyCss, /\.familyBubbleFooter[\s\S]*?width:\s*100%;/);
  assert.doesNotMatch(familyCss, /\.familyBubbleEditIcon[\s\S]*?width:\s*100%;/);
});

test("family bubbles can be edited and deleted through composer mode", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(clientSource, /editingMessageId/);
  assert.match(clientSource, /function startEditMessage\(message\)/);
  assert.match(clientSource, /onEditMessage=\{startEditMessage\}/);
  assert.match(clientSource, /function deleteMessage\(messageId\)/);
  assert.match(clientSource, /window\.confirm\("삭제할까요\?"\)/);
  assert.match(clientSource, /setMessages\(\(current\) => current\.filter\(\(message\) => message\.id !== messageId\)\)/);
  assert.match(clientSource, /if \(editingMessageId === messageId\) \{\s*resetComposer\(\);\s*\}/);
  assert.match(clientSource, /\{isEditing \? "저장" : "보내기"\}/);
  assert.match(clientSource, />\s*취소\s*<\/button>/);
  assert.match(clientSource, /function checklistToDraft\(message\)/);
  assert.match(clientSource, /function applyChecklistEdit\(parsedChecklist, existingItems = \[\]\)/);
  assert.match(clientSource, /checkedStateQueues\.get\(item\.text\)/);
  assert.match(clientSource, /checked:\s*previous \? previous\.checked : false/);
  assert.match(clientSource, /setMessages\(\(current\) =>\s*current\.map/);
  assert.match(familyCss, /\.familyBubbleEditing \.familyBubble\s*\{/);
  assert.match(familyCss, /\.familyBubbleEditing \.familyBubbleEditIcon\s*\{/);
  assert.match(familyCss, /\.familyCancel\s*\{/);
});
