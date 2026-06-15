import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family shared header uses polished tab wording and routes", async () => {
  const headerSource = await readSource("../app/family/FamilyHeader.js");
  const logoSource = await readSource("../public/family-logo.svg");

  assert.ok(headerSource.includes('import Image from "next/image"'), "Family logo should use Next Image");
  assert.ok(headerSource.includes("familyLogoLink"), "logo link should be rendered in the Family header");
  assert.ok(headerSource.includes('href="/family"'), "logo should navigate home to /family");
  assert.ok(headerSource.includes('src="/family-logo.svg"'), "Family header should use the Family logo asset");
  assert.ok(headerSource.includes("width={68}"));
  assert.ok(headerSource.includes("height={68}"));
  assert.ok(headerSource.includes("priority"));
  assert.ok(headerSource.includes("unoptimized"), "SVG logo should bypass Next image optimization");
  assert.ok(!headerSource.includes("<img"), "raw img should not be used for the Family logo");
  assert.ok(!headerSource.includes("<h1>가족</h1>"), "old text banner title should not remain");
  assert.ok(logoSource.includes("<svg"));
  assert.ok(logoSource.includes("#f06f9c"));

  for (const label of ["달력", "할일", "로운이", "메모장"]) {
    assert.ok(headerSource.includes(label), `${label} should be in the Family header`);
  }
  assert.ok(headerSource.indexOf("달력") < headerSource.indexOf("할일"));
  assert.ok(headerSource.indexOf("할일") < headerSource.indexOf("로운이"));
  assert.ok(headerSource.indexOf("로운이") < headerSource.indexOf("메모장"));
  for (const route of ["/family/calendar", "/family", "/family/roun", "/family/memo"]) {
    assert.ok(headerSource.includes(route), `${route} should remain available`);
  }
  for (const oldLabel of ["모하꼬?", "뭐라꼬?", "은제?", "모라노", "대시보드", "로니", "로우니"]) {
    assert.ok(!headerSource.includes(oldLabel), `${oldLabel} should not remain in the Family header`);
  }
});

test("family memo page uses finalized title and checklist glyph", async () => {
  const memoSource = await readSource("../app/family/FamilyPageClient.js");

  assert.ok(memoSource.includes('aria-label="메모장"'));
  assert.ok(memoSource.includes("<h2>메모장</h2>"));
  assert.ok(memoSource.includes(""));
  for (const label of ["수정", "삭제", "저장", "취소"]) {
    assert.ok(memoSource.includes(label), `${label} should be available in memo actions`);
  }
});

test("family font no longer exposes Hyunok and remains Family-scoped", async () => {
  const familyCss = await readSource("../app/styles/family.css");

  assert.ok(familyCss.includes(".familyPage"));
  assert.ok(familyCss.includes("font-family"));
  assert.ok(familyCss.includes("Apple SD Gothic Neo"));
  assert.ok(familyCss.includes("Noto Sans KR"));
  assert.ok(familyCss.includes("system-ui"));
  for (const removedFont of ["Hyunok", "현옥", "GangwonEducationHyunokSam"]) {
    assert.ok(!familyCss.includes(removedFont), `${removedFont} should not remain in Family CSS`);
  }
});

test("family dashboard and calendar expose standard labels", async () => {
  const dashboardSource = await readSource("../app/family/FamilyDashboardClient.js");
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const calendarDataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const globalsCss = await readSource("../app/globals.css");

  for (const label of ["달력", "할 일", "로운이 시간표", "일정", "+ 일정"]) {
    assert.ok((dashboardSource + calendarSource + roniSource).includes(label), `${label} should appear in dashboard/calendar UI`);
  }
  for (const oldLabel of ["로니", "로우니", "뭐라꼬?", "은제?", "모하꼬?"]) {
    assert.ok(!(dashboardSource + calendarSource + roniSource).includes(oldLabel), `${oldLabel} should not appear in visible Family sources`);
  }
  for (const value of [
    "kaosgdd.family.calendarItems.v1",
    "kaosgdd.family.defaultTimetable.v1",
    "kaosgdd.family.rounWeeklyPlans.v1",
    "kaosgdd.family.rounAssignments.v1",
    "FAMILY_CALENDAR_DAY_LABELS",
  ]) {
    assert.ok(calendarDataSource.includes(value));
  }
  assert.ok(globalsCss.includes("family-calendar.css"));
  assert.ok(globalsCss.includes("family-roni-templates.css"));
});

test("family polish keeps the baseline compact and overflow-safe", async () => {
  const polishCss = await readSource("../app/styles/family-polish.css");
  const roniCss = await readSource("../app/styles/family-roni-templates.css");

  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?font-size:\s*14px;/);
  assert.match(polishCss, /\.familyHeader\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?min-height:\s*72px;[\s\S]*?overflow:\s*hidden;/);
  assert.match(polishCss, /\.familyLogoLink\s*\{[\s\S]*?width:\s*68px;[\s\S]*?text-decoration:\s*none;/);
  assert.match(polishCss, /\.familyLogo\s*\{[\s\S]*?width:\s*68px;[\s\S]*?object-fit:\s*contain;/);
  assert.match(polishCss, /\.familyHomeNav\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow:\s*hidden;/);
  assert.match(polishCss, /\.familyHomeNavLink\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(polishCss, /\.familyHomeNavLinkActive::after\s*\{[\s\S]*?height:\s*2px;[\s\S]*?background:\s*rgba\(216, 111, 152, 0\.72\);/);
  assert.match(polishCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyLogo\s*\{[\s\S]*?width:\s*62px;/);
  assert.match(polishCss, /@media\s*\(max-width:\s*360px\)\s*\{[\s\S]*?\.familyHomeNavLink\s*\{[\s\S]*?font-size:\s*13px;/);
  assert.match(roniCss, /\.familyRoniTemplateRow\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(roniCss, /\.familyRoniTemplateActions[\s\S]*?\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(roniCss, /overflow-wrap:\s*anywhere;/);
});
