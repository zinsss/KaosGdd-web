import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family page uses NanumBarunPen without changing global fonts", async () => {
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyFontsCss = await readFile(new URL("../app/styles/family-fonts.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.ok(globalsCss.includes('family-fonts.css'));
  assert.match(familyFontsCss, /@font-face\s*\{[\s\S]*?font-family:\s*"NanumBarunPen";/);
  assert.match(familyFontsCss, /@font-face\s*\{[\s\S]*?NanumBarunpen\.woff/);
  assert.match(familyFontsCss, /@font-face\s*\{[\s\S]*?font-display:\s*swap;/);
  assert.match(
    familyFontsCss,
    /\.familyPage[\s\S]*?font-family:\s*"NanumBarunPen",\s*"Apple SD Gothic Neo",\s*"Noto Sans KR",\s*sans-serif;/,
  );
  assert.match(familyFontsCss, /\.familyPage button/);
  assert.match(familyFontsCss, /\.familyPage input/);
  assert.match(familyFontsCss, /\.familyPage textarea/);
  assert.match(familyFontsCss, /\.familyPage select/);

  for (const source of [familyFontsCss, baseCss, shellCss]) {
    assert.doesNotMatch(source, /GangwonEducationHyunokSam|GangwonEduHyeonokT_OTFMediumA|Hyunok|현옥/);
  }
  assert.doesNotMatch(baseCss, /NanumBarunPen/);
  assert.doesNotMatch(shellCss, /NanumBarunPen/);
});
