import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family page route exposes a Korean quick pad shell", async () => {
  const pageSource = await readFile(new URL("../app/family/page.js", import.meta.url), "utf8");
  const clientSource = await readFile(new URL("../app/family/FamilyPageClient.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");

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
  assert.match(globalsCss, /@import "\.\/styles\/family\.css";/);
  assert.match(familyCss, /\.familyPage\s*\{/);
  assert.match(familyCss, /#ffd8e5/);
});
