import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  return match ? match[0] : "";
}

test("family page route exposes a Korean quick pad shell", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const topNavSource = await readFile(new URL("../components/TopNav.js", import.meta.url), "utf8");

  assert.match(pageSource, /FamilyPageClient/);
  assert.match(clientSource, /가족 메모/);
  assert.match(clientSource, /가족 메모를 남겨요/);
  assert.match(clientSource, /체크리스트 모드/);
  assert.match(clientSource, /parseChecklistInput/);
  assert.match(clientSource, /title:\s*lines\[0\]/);
  assert.match(clientSource, /items:\s*lines\.slice\(1\)/);
  assert.match(clientSource, /☐/);
  assert.match(clientSource, /☑/);
  assert.doesNotMatch(clientSource.toLowerCase(), /therapy/);
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
  assert.match(bubbleFooterCss, /gap:\s*8px;/);
  assert.match(bubbleTimeCss, /font-size:\s*0\.76rem;/);
  assert.match(deleteIconCss, /position:\s*absolute;/);
  assert.match(deleteIconCss, /right:\s*8px;/);
  assert.match(deleteIconCss, /top:\s*7px;/);
  assert.doesNotMatch(editIconCss, /position:\s*absolute;/);
  assert.doesNotMatch(editIconCss, /bottom:\s*7px;/);
  assert.doesNotMatch(familyCss, /\.familyBubbleActions/);
  assert.doesNotMatch(familyCss, /grid-template-columns:\s*minmax\(0, 1fr\) 24px;/);
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
