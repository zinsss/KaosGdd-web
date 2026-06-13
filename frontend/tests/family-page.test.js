import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family routes expose dashboard and keep the memo playground direct", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const memoPageSource = await readFile(new URL("../app/family/memo/page.js", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(pageSource, /FamilyDashboardClient/);
  assert.match(memoPageSource, /FamilyPageClient/);
  assert.match(dashboardSource, /가족 대시보드/);
  assert.match(dashboardSource, /뭐하노/);
  assert.match(dashboardSource, /뭐라캤노/);
  assert.doesNotMatch(dashboardSource, />\s*대시보드\s*</);
  assert.doesNotMatch(dashboardSource, />\s*메모장\s*</);
  assert.match(dashboardSource, /\/family\/memo/);
  assert.match(clientSource, /가족 메모/);
  assert.match(clientSource, /가족 메모를 남겨요/);
  assert.match(clientSource, /체크리스트 모드/);
  assert.match(clientSource, /parseChecklistInput/);
  assert.match(clientSource, /title:\s*lines\[0\]/);
  assert.match(clientSource, /items:\s*lines\.slice\(1\)/);
  assert.match(clientSource, /☐/);
  assert.match(clientSource, /☑/);
  assert.match(clientSource, //);
  assert.doesNotMatch(`${clientSource}\n${timetableSource}`.toLowerCase(), /therapy/);
  assert.match(globalsCss, /family\.css/);
  assert.match(globalsCss, /family-tasks\.css/);
  assert.match(familyCss, /\.familyPage[\s\S]*?font-family:/);
  assert.match(familyCss, /#ffd8e5/);
});

test("family composer avoids iOS zoom and resets textarea height after send", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyInput\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(familyCss, /\.familyChecklistToggle,\s*\.familySend,\s*\.familyCancel\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(clientSource, /const inputRef = useRef\(null\);/);
  assert.match(clientSource, /function resetInputHeight\(\)/);
  assert.match(clientSource, /el\.style\.height = "";/);
  assert.match(clientSource, /function resizeInputToContent/);
  assert.match(clientSource, /Math\.min\(el\.scrollHeight, 148\)/);
  assert.match(clientSource, /rows=\{checklistMode \? 4 : 1\}/);
  assert.match(clientSource, /onChange=\{handleDraftChange\}/);
  assert.match(clientSource, /requestAnimationFrame\(resetInputHeight\)/);
  assert.match(clientSource, /className=\{`familyChecklistToggle/);
  assert.match(clientSource, />\s*\s*<\/button>/);
});

test("family default timetable uses a local weekly template model", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(clientSource, /메모/);
  assert.match(clientSource, /기본 시간표/);
  assert.match(clientSource, /familyMode/);
  assert.match(clientSource, /setFamilyMode\("memo"\)/);
  assert.match(clientSource, /setFamilyMode\("timetable"\)/);
  assert.match(clientSource, /<FamilyTimetable \/>/);
  assert.match(timetableSource, /FAMILY_TIMETABLE_STORAGE_KEY = "kaosgdd\.family\.defaultTimetable\.v1"/);
  assert.match(timetableSource, /TIMETABLE_START_HOUR = 8/);
  assert.match(timetableSource, /TIMETABLE_END_HOUR = 22/);
  assert.match(timetableSource, /TIMETABLE_SLOT_MINUTES = 10/);
  assert.match(timetableSource, /DEFAULT_TIMETABLE_DURATION_MINUTES = 40/);
  for (const color of ["pink", "rose", "peach", "yellow", "mint", "green", "sky", "blue", "lavender", "purple", "cream", "gray"]) {
    assert.match(timetableSource, new RegExp(`"${color}"`));
  }
  for (const dayLabel of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(timetableSource, new RegExp(`label: "${dayLabel}"`));
  }
  assert.match(timetableSource, /function timeToMinutes\(timeString\)/);
  assert.match(timetableSource, /function minutesToTime\(totalMinutes\)/);
  assert.match(timetableSource, /function snapMinutes\(totalMinutes\)/);
  assert.match(timetableSource, /function createDefaultTimetableEntry/);
  assert.match(timetableSource, /window\.localStorage\.getItem\(FAMILY_TIMETABLE_STORAGE_KEY\)/);
  assert.match(timetableSource, /window\.localStorage\.setItem\(FAMILY_TIMETABLE_STORAGE_KEY, JSON\.stringify\(entries\)\)/);
  assert.doesNotMatch(timetableSource, /function addTimetableEntry/);
  assert.doesNotMatch(timetableSource, /window\.prompt/);
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
  assert.match(familyCss, /\.familyTimetableEditor\s*\{/);
});

test("family timetable uses compact no-scroll mobile layout", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(timetableSource, /familyTimetableHourFull/);
  assert.match(timetableSource, /familyTimetableHourCompact/);
  assert.match(timetableSource, /familyTimetableHourCompact/);
  assert.match(timetableSource, /familyTimetableHourFull/);
  assert.match(familyCss, /\.familyTimetableHourCompact\s*\{\s*display:\s*none;/);
  assert.match(familyCss, /overflow-x:\s*hidden;/);
  assert.match(familyCss, /grid-template-columns:\s*24px repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(familyCss, /\.familyTimetableHourFull\s*\{[\s\S]*?display:\s*none;/);
  assert.match(familyCss, /\.familyTimetableHourCompact\s*\{[\s\S]*?display:\s*inline;/);
  assert.match(familyCss, /\.familyTimetableEntryTime\s*\{[\s\S]*?display:\s*none;/);
});

test("family scrollable areas use pastel family scrollbars", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyInput::-webkit-scrollbar/);
  assert.match(familyCss, /\.familyInput::-webkit-scrollbar-track/);
  assert.match(familyCss, /\.familyInput::-webkit-scrollbar-thumb/);
  assert.match(familyCss, /\.familyStream::-webkit-scrollbar-thumb/);
  assert.match(familyCss, /\.familyTimetableScroller::-webkit-scrollbar-thumb/);
  assert.match(familyCss, /width:\s*8px;/);
  assert.match(familyCss, /height:\s*8px;/);
  assert.match(familyCss, /background:\s*rgba\(255, 248, 251, 0\.76\);/);
  assert.match(familyCss, /background:\s*rgba\(214, 128, 157, 0\.58\);/);
  assert.doesNotMatch(baseCss, /familyInput|214, 128, 157|255, 248, 251/);
  assert.doesNotMatch(shellCss, /familyInput|214, 128, 157|255, 248, 251/);
});

test("family bubbles keep edit control in the footer with time", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(clientSource, /familyBubbleRow/);
  assert.match(clientSource, /familyBubbleContent/);
  assert.match(clientSource, /familyBubbleFooter/);
  assert.match(clientSource, /familyBubbleDeleteIcon/);
  assert.match(clientSource, /familyBubbleEditIcon/);
  assert.match(clientSource, /×/);
  assert.match(clientSource, /✎/);
  assert.match(clientSource, /familyBubbleFooter/);
  assert.doesNotMatch(clientSource, /familyBubbleActions/);
  assert.doesNotMatch(clientSource, />\s*수정\s*<\/button>/);
  assert.match(familyCss, /\.familyBubbleRow\s*\{[\s\S]*?width:\s*100%;/);
  assert.match(familyCss, /\.familyBubble\s*\{[\s\S]*?position:\s*relative;/);
  assert.match(familyCss, /\.familyBubble\s*\{[\s\S]*?max-width:\s*none;/);
  assert.match(familyCss, /\.familyBubbleFooter\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(familyCss, /\.familyBubbleFooter\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(familyCss, /\.familyBubbleTime\s*\{[\s\S]*?display:\s*inline-flex;/);
  assert.match(familyCss, /\.familyBubbleDeleteIcon\s*\{[\s\S]*?position:\s*absolute;/);
  assert.match(familyCss, /\.familyBubbleEditIcon\s*\{[\s\S]*?position:\s*static;[\s\S]*?flex:\s*0 0 auto;/);
  assert.doesNotMatch(familyCss, /\.familyBubbleActions/);
});

test("family bubbles can be edited and deleted through composer mode", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(clientSource, /editingMessageId/);
  assert.match(clientSource, /function startEditMessage\(message\)/);
  assert.match(clientSource, /function deleteMessage\(messageId\)/);
  assert.match(clientSource, /window\.confirm\("삭제할까요\?"\)/);
  assert.match(clientSource, /resetComposer\(\)/);
  assert.match(clientSource, /저장/);
  assert.match(clientSource, /취소/);
  assert.match(clientSource, /function checklistToDraft\(message\)/);
  assert.match(clientSource, /function applyChecklistEdit\(parsedChecklist, existingItems = \[\]\)/);
  assert.match(clientSource, /checkedStateQueues\.get\(item\.text\)/);
  assert.match(clientSource, /checked:\s*previous \? previous\.checked : false/);
  assert.match(familyCss, /\.familyBubbleEditing \.familyBubble\s*\{/);
  assert.match(familyCss, /\.familyBubbleEditing \.familyBubbleEditIcon\s*\{/);
  assert.match(familyCss, /\.familyCancel\s*\{/);
});
