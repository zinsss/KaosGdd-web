import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family page uses larger Hyunok font sizing without affecting global UI", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyCss, /@font-face\s*\{[\s\S]*?font-family:\s*'GangwonEducationHyunokSam'/);
  assert.match(addCss, /\.familyPage\s*\{\s*font-size:\s*18px;\s*\}/);
  assert.match(familyCss, /\.familyPage button,\s*\.familyPage input,\s*\.familyPage textarea,\s*\.familyPage select\s*\{[\s\S]*?font-family:\s*inherit;/);
  assert.match(familyCss, /\.familyInput\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.doesNotMatch(baseCss, /GangwonEducationHyunokSam/);
  assert.doesNotMatch(shellCss, /GangwonEducationHyunokSam/);
});

test("family timetable palette uses distinct pastel schedule colors", async () => {
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  for (const [className, color] of [
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
  ]) {
    assert.match(
      addCss,
      new RegExp(`\\.familyTimetableEntry${className},\\s*\\.familyTimetableColorChip${className}\\s*\\{[\\s\\S]*?background:\\s*${color};`),
    );
  }
});

test("family timetable color chips remain color-only and accessible", async () => {
  const timetableSource = await readFile(new URL("../app/family/FamilyTimetable.js", import.meta.url), "utf8");
  const addCss = await readFile(new URL("../app/styles/family-timetable-add.css", import.meta.url), "utf8");

  assert.match(timetableSource, /aria-label=\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.match(timetableSource, /title=\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}/);
  assert.doesNotMatch(timetableSource, /<button[\s\S]*>\s*\{FAMILY_TIMETABLE_COLOR_LABELS\[color\]\}\s*<\/button>/);
  assert.match(addCss, /\.familyTimetableColorChip\s*\{[\s\S]*?color:\s*transparent;/);
  assert.match(addCss, /\.familyTimetableColorChip\s*\{[\s\S]*?font-size:\s*0;/);
});
