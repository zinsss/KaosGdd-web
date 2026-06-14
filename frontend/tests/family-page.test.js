import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family routes expose dashboard and direct memo page with polished labels", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const memoPageSource = await readFile(new URL("../app/family/memo/page.js", import.meta.url), "utf8");
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const headerSource = await readFile(new URL("../app/family/FamilyHeader.js", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/family/FamilyDashboardClient.js", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.match(pageSource, /FamilyDashboardClient/);
  assert.match(memoPageSource, /FamilyPageClient/);
  assert.match(timetablePageSource, /FamilyTimetable/);
  assert.match(headerSource, /우짜노우짤꼬/);
  assert.match(headerSource, /모하노/);
  assert.match(headerSource, /모라노/);
  assert.match(dashboardSource, /뭔날/);
  assert.match(dashboardSource, /뭔일/);
  assert.match(dashboardSource, /뭔일이고/);
  assert.match(dashboardSource, /하그라/);
  assert.match(dashboardSource, /다했데이/);
  assert.match(dashboardSource, /\/family\/timetable/);
  assert.match(dashboardSource, /\/family\/tasks\/new/);
  assert.match(dashboardSource, /\/family\/tasks\/done/);
  assert.match(clientSource, /aria-label="모라노"/);
  assert.match(clientSource, /<h2>모라꼬\?<\/h2>/);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, /모라켔노|뭐라켔노/);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, />\s*대시보드\s*</);
  assert.doesNotMatch(`${headerSource}\n${dashboardSource}\n${clientSource}`, />\s*메모장\s*</);
  assert.doesNotMatch(clientSource, /FamilyTimetable|familyMode|기본 시간표/);
  assert.doesNotMatch(`${clientSource}\n${timetableSource}`.toLowerCase(), /therapy/);
  assert.match(globalsCss, /family\.css/);
  assert.match(globalsCss, /family-tasks\.css/);
  assert.match(globalsCss, /family-polish\.css/);
  assert.match(familyCss, /GangwonEducationHyunokSam/);
  assert.match(polishCss, /\.familyHeader h1\s*\{[\s\S]*?color:\s*#d86f98;/);
  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*22px;/);
  assert.match(polishCss, /\.familyQuickPadTitle\s*\{/);
});

test("family composer avoids iOS zoom and resets textarea height after send", async () => {
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyInput\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(familyCss, /\.familyChecklistToggle,\s*\.familySend,\s*\.familyCancel\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(polishCss, /\.familyInput[\s\S]*?font-size:\s*18px;/);
  assert.match(clientSource, /const inputRef = useRef\(null\);/);
  assert.match(clientSource, /function resetInputHeight\(\)/);
  assert.match(clientSource, /el\.style\.height = "";/);
  assert.match(clientSource, /function resizeInputToContent/);
  assert.match(clientSource, /Math\.min\(el\.scrollHeight, 148\)/);
  assert.match(clientSource, /rows=\{checklistMode \? 4 : 1\}/);
  assert.match(clientSource, /onChange=\{handleDraftChange\}/);
  assert.match(clientSource, /requestAnimationFrame\(resetInputHeight\)/);
  assert.match(clientSource, /className=\{`familyChecklistToggle/);
  assert.match(clientSource, />\s*\s*<\/button>/);
});

test("family default timetable uses a local weekly template model", async () => {
  const timetablePageSource = await readFile(new URL("../app/family/timetable/page.js", import.meta.url), "utf8");
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(timetablePageSource, /FamilyHeader/);
  assert.match(timetablePageSource, /FamilyTimetable/);
  assert.match(timetablePageSource, /뭔일이고/);
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
  assert.match(familyCss, /\.familyTimetable\s*\{/);
  assert.match(familyCss, /\.familyTimetableGrid\s*\{/);
  assert.match(familyCss, /\.familyTimetableEditor\s*\{/);
});

test("family timetable uses compact no-scroll mobile layout", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

  assert.match(timetableSource, /familyTimetableHourFull/);
  assert.match(timetableSource, /familyTimetableHourCompact/);
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
  assert.match(clientSource, /되따/);
  assert.match(clientSource, /고마하자/);
  assert.match(clientSource, /function checklistToDraft\(message\)/);
  assert.match(clientSource, /function applyChecklistEdit\(parsedChecklist, existingItems = \[\]\)/);
  assert.match(clientSource, /checkedStateQueues\.get\(item\.text\)/);
  assert.match(clientSource, /checked:\s*previous \? previous\.checked : false/);
  assert.match(familyCss, /\.familyBubbleEditing \.familyBubble\s*\{/);
  assert.match(familyCss, /\.familyBubbleEditing \.familyBubbleEditIcon\s*\{/);
  assert.match(familyCss, /\.familyCancel\s*\{/);
});

test("family polish keeps larger mobile-safe type without form overflow", async () => {
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(globalsCss, /family-polish\.css/);
  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*22px;/);
  assert.match(polishCss, /\.familyHeader h1\s*\{[\s\S]*?font-size:\s*30px;/);
  assert.match(polishCss, /\.familyHomeNavLink\s*\{[\s\S]*?font-size:\s*17px;/);
  assert.match(polishCss, /\.familyTaskForm input,[\s\S]*?\.familyTaskForm textarea\s*\{[\s\S]*?max-width:\s*100%;/);
  assert.match(polishCss, /\.familyTaskForm input,[\s\S]*?\.familyTaskForm textarea\s*\{[\s\S]*?box-sizing:\s*border-box;/);
  assert.match(polishCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyTaskFormActions,[\s\S]*?display:\s*grid;/);
  assert.match(polishCss, /@media \(max-width: 640px\) \{[\s\S]*?\.familyPage\s*\{[\s\S]*?width:\s*calc\(100% - 16px\);/);
});
