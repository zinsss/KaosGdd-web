import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family page uses Seoul Namsan Condensed without changing global fonts", async () => {
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const familyFontsCss = await readFile(new URL("../app/styles/family-fonts.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");
  const fontPresetSource = await readFile(new URL("../app/family/familyTimetableFonts.js", import.meta.url), "utf8");

  assert.ok(globalsCss.includes('family-fonts.css'));
  assert.ok(
    globalsCss.indexOf('family-polish.css') < globalsCss.indexOf('family-fonts.css'),
    "Family font guard should load after module polish CSS so editable controls stay at 16px",
  );
  assert.match(familyFontsCss, /@font-face\s*\{[\s\S]*?font-family:\s*"Seoul Namsan Condensed";/);
  assert.match(familyFontsCss, /SeoulNamsanCondensed-Medium\.woff2/);
  assert.match(familyFontsCss, /SeoulNamsanCondensed-Medium\.woff/);
  assert.match(familyFontsCss, /SeoulNamsanCondensed-Medium\.ttf/);
  assert.match(familyFontsCss, /@font-face\s*\{[\s\S]*?font-family:\s*"NanumBarunPen";/);
  assert.match(familyFontsCss, /@font-face\s*\{[\s\S]*?font-display:\s*swap;/);
  assert.match(
    familyFontsCss,
    /\.familyPage[\s\S]*?font-family:\s*"Seoul Namsan Condensed",\s*"NanumBarunPen",\s*"Apple SD Gothic Neo",\s*"Noto Sans KR",\s*sans-serif;/,
  );
  assert.match(familyFontsCss, /\.familyPage button/);
  assert.match(familyFontsCss, /\.familyPage input/);
  assert.match(familyFontsCss, /\.familyPage textarea/);
  assert.match(familyFontsCss, /\.familyPage select/);
  assert.match(familyFontsCss, /\.familyPage \[contenteditable="true"\]/);
  assert.match(
    familyFontsCss,
    /\.familyPage input,\s*\n\.familyPage textarea,\s*\n\.familyPage select,\s*\n\.familyPage \[contenteditable="true"\]\s*\{[\s\S]*?font-size:\s*16px;/,
  );
  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*14px;/);

  for (const source of [familyFontsCss, polishCss]) {
    assert.doesNotMatch(
      source,
      /\.(?:familyTimetableEditor|familyTaskForm)[\s\S]{0,160}(?:input|select|textarea)[\s\S]{0,220}font-size:\s*(?:1[0-5]px|0\.[0-9]+rem)/,
    );
  }

  assert.match(fontPresetSource, /FAMILY_TIMETABLE_FONT_PRESETS/);
  assert.match(fontPresetSource, /SeoulNamsanCondensed/);
  assert.match(fontPresetSource, /서울남산/);
  assert.match(fontPresetSource, /NanumBarunPen/);
  assert.match(fontPresetSource, /FAMILY_TIMETABLE_DEFAULT_FONT\s*=\s*"system"/);
  assert.match(fontPresetSource, /normalizeFamilyTimetableFont/);

  for (const source of [familyFontsCss, fontPresetSource, baseCss, shellCss]) {
    assert.doesNotMatch(source, /GangwonEducationHyunokSam|GangwonEduHyeonokT_OTFMediumA|Hyunok|현옥/);
  }
  assert.doesNotMatch(baseCss, /Seoul Namsan Condensed|NanumBarunPen/);
  assert.doesNotMatch(shellCss, /Seoul Namsan Condensed|NanumBarunPen/);
});
