import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family page uses GangwonEducationHyunokSam without changing global fonts", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const timetableAddCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyCss, /@font-face\s*\{[\s\S]*font-family:\s*["']GangwonEducationHyunokSam["'];/);
  assert.match(familyCss, /@font-face\s*\{[\s\S]*GangwonEduHyeonokT_OTFMediumA\.woff/);
  assert.match(familyCss, /@font-face\s*\{[\s\S]*font-display:\s*swap;/);
  assert.match(familyCss, /\.familyPage[\s\S]*?font-family:\s*"GangwonEducationHyunokSam", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;/);
  assert.match(timetableAddCss, /\.familyPage[\s\S]*?font-size:\s*18px;/);
  assert.match(familyCss, /\.familyPage button[\s\S]*?font-family:\s*inherit;/);
  assert.match(familyCss, /\.familyPage input/);
  assert.match(familyCss, /\.familyPage textarea/);
  assert.match(familyCss, /\.familyPage select/);

  assert.doesNotMatch(baseCss, /GangwonEducationHyunokSam|GangwonEduHyeonokT_OTFMediumA/);
  assert.doesNotMatch(shellCss, /GangwonEducationHyunokSam|GangwonEduHyeonokT_OTFMediumA/);
});
