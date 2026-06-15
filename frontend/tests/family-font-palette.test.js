import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const TIMETABLE_COLORS = [
  ["Pink", "#ffd8e5"],
  ["Rose", "#ffe4ec"],
  ["Cream", "#fff8df"],
  ["Yellow", "#fff0a8"],
  ["Peach", "#ffd9b8"],
  ["Mint", "#d6f5ea"],
  ["Green", "#dff5cf"],
  ["Sky", "#d9f1ff"],
  ["Blue", "#dbeafe"],
  ["Purple", "#eadcff"],
  ["Lavender", "#f0e7ff"],
  ["Gray", "#ece8e3"],
];

test("family page uses Seoul Namsan font sizing without affecting global UI", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const familyFontsCss = await readFile(new URL("../app/styles/family-fonts.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");
  const fontPresetSource = await readFile(new URL("../app/family/familyTimetableFonts.js", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyFontsCss, /@font-face[\s\S]*?Seoul Namsan Condensed/);
  assert.match(familyFontsCss, /SeoulNamsanCondensed-Medium\.woff2/);
  assert.match(familyFontsCss, /\.familyPage[\s\S]*?font-family:\s*"Seoul Namsan Condensed",\s*"NanumBarunPen",\s*"Apple SD Gothic Neo",\s*"Noto Sans KR",\s*sans-serif;/);
  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*14px;/);
  assert.match(familyFontsCss, /\.familyPage button/);
  assert.match(familyFontsCss, /\.familyPage input/);
  assert.match(familyFontsCss, /\.familyPage textarea/);
  assert.match(familyFontsCss, /\.familyPage select/);
  assert.match(familyCss, /\.familyInput[\s\S]*?font-size:\s*16px;/);
  assert.match(fontPresetSource, /SeoulNamsanCondensed/);
  assert.match(fontPresetSource, /서울남산/);
  assert.match(fontPresetSource, /NanumBarunPen/);
  assert.match(fontPresetSource, /FAMILY_TIMETABLE_DEFAULT_FONT\s*=\s*"system"/);
  assert.doesNotMatch(familyFontsCss, /GangwonEducationHyunokSam|Hyunok|현옥/);
  assert.doesNotMatch(fontPresetSource, /GangwonEducationHyunokSam|Hyunok|현옥/);
  assert.doesNotMatch(baseCss, /Seoul Namsan Condensed|NanumBarunPen|GangwonEducationHyunokSam|Hyunok|현옥/);
  assert.doesNotMatch(shellCss, /Seoul Namsan Condensed|NanumBarunPen|GangwonEducationHyunokSam|Hyunok|현옥/);
});

test("family timetable palette uses twelve distinct pastel schedule colors", async () => {
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  assert.equal(TIMETABLE_COLORS.length, 12);
  for (const [className, color] of TIMETABLE_COLORS) {
    assert.match(addCss, new RegExp(`\\.familyTimetableEntry${className}`));
    assert.match(addCss, new RegExp(`\\.familyTimetableColorChip${className}`));
    assert.ok(addCss.toLowerCase().includes(color), `missing palette color ${color}`);
  }
});

test("family timetable color chips remain color-only and accessible", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  assert.match(timetableSource, /aria-label=\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.match(timetableSource, /title=\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.match(timetableSource, /className=\{`familyTimetableColorChip/);
  assert.doesNotMatch(timetableSource, /familyTimetableColorChipLabel/);
  assert.match(addCss, /\.familyTimetableColorChip[\s\S]*?color:\s*transparent;/);
  assert.match(addCss, /\.familyTimetableColorChip[\s\S]*?font-size:\s*0;/);
});
