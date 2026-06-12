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
  const familyComposerButtonCss = cssBlock(familyCss, ".familyChecklistToggle,\n.familySend");

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
  assert.match(clientSource, /setDraft\(""\);\s*requestAnimationFrame\(resetInputHeight\);/);
});
