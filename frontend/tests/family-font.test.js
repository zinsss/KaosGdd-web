import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("family page uses standard Korean fallback fonts without changing global fonts", async () => {
  const familyCss = await readFile(new URL("../app/styles/family.css", import.meta.url), "utf8");
  const polishCss = await readFile(new URL("../app/styles/family-polish.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(familyCss, /\.familyPage[\s\S]*?font-family:\s*"Apple SD Gothic Neo",\s*"Noto Sans KR",\s*system-ui,\s*sans-serif;/);
  assert.match(polishCss, /\.familyPage[\s\S]*?font-size:\s*22px;/);
  assert.match(familyCss, /\.familyPage button[\s\S]*?font-family:\s*inherit;/);
  assert.match(familyCss, /\.familyPage input/);
  assert.match(familyCss, /\.familyPage textarea/);
  assert.match(familyCss, /\.familyPage select/);

  for (const source of [familyCss, baseCss, shellCss]) {
    assert.doesNotMatch(source, /GangwonEducationHyunokSam|GangwonEduHyeonokT_OTFMediumA|Hyunok|현옥/);
  }
});
