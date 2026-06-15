import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const TIMETABLE_COLORS = [
  ["Pink", "#ffc6dc"],
  ["Rose", "#ffb3c7"],
  ["Peach", "#ffd2ba"],
  ["Yellow", "#ffe08a"],
  ["Mint", "#c9f2d2"],
  ["Green", "#bcebc2"],
  ["Sky", "#c9f2ff"],
  ["Blue", "#c7dcff"],
  ["Lavender", "#e0c8ff"],
  ["Purple", "#e8bff0"],
  ["Cream", "#fff1b8"],
  ["Gray", "#ded8d2"],
];

test("family page uses larger NanumBarunPen font sizing without affecting global UI", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const familyFontsCss = await readFile(new URL("../app/styles/family-fonts.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyFontsCss, /@font-face[\s\S]*?NanumBarunPen/);
  assert.match(familyFontsCss, /\.familyPage[\s\S]*?font-family:\s*"NanumBarunPen",\s*"Apple SD Gothic Neo",\s*"Noto Sans KR",\s*sans-serif;/);
  assert.match(polishCss, /\.familyPage[\s\S]*?font-size:\s*22px;/);
  assert.match(familyFontsCss, /\.familyPage button/);
  assert.match(familyFontsCss, /\.familyPage input/);
  assert.match(familyFontsCss, /\.familyPage textarea/);
  assert.match(familyFontsCss, /\.familyPage select/);
  assert.match(familyCss, /\.familyInput[\s\S]*?font-size:\s*16px;/);
  assert.doesNotMatch(familyFontsCss, /GangwonEducationHyunokSam|Hyunok|현옥/);
  assert.doesNotMatch(baseCss, /NanumBarunPen|GangwonEducationHyunokSam|Hyunok|현옥/);
  assert.doesNotMatch(shellCss, /NanumBarunPen|GangwonEducationHyunokSam|Hyunok|현옥/);
});

test("family timetable palette uses distinct pastel schedule colors", async () => {
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

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
