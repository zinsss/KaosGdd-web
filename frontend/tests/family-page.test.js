import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family shared header uses polished tab wording and routes", async () => {
  const headerSource = await readSource("../app/family/FamilyHeader.js");

  assert.ok(!headerSource.includes('import Image from "next/image"'), "Family header should not render a logo image");
  assert.ok(headerSource.includes("familyLogoLink"), "text logo link should remain in the Family header");
  assert.ok(headerSource.includes('href="/family"'), "text logo should navigate home to /family");
  assert.ok(headerSource.includes("familyTextLogo"), "Family header should use the dedicated text logo class");
  assert.ok(headerSource.includes("로운이와 나"), "Family header should render the text logo");
  assert.ok(!headerSource.includes("familyHeaderLogo"), "image logo class should not remain in the Family header");
  assert.ok(!headerSource.includes("rouny-me-icon"), "Rouny&Me image asset should not be referenced");
  assert.ok(!headerSource.includes("/family-logo.svg"), "generic house logo path should not remain");
  assert.ok(!headerSource.includes("rouny-me-icon.svg"), "generated SVG approximation should not remain");
  assert.ok(!headerSource.includes("<img"), "raw img should not be used in the Family header");
  assert.ok(!headerSource.includes("<h1>가족</h1>"), "old text banner title should not remain");

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

test("family page metadata uses standard Korean titles", async () => {
  const pageSources = [
    await readSource("../app/family/page.js"),
    await readSource("../app/family/memo/page.js"),
    await readSource("../app/family/timetable/page.js"),
    await readSource("../app/family/calendar/rouny/page.js"),
    await readSource("../app/family/calendar/events/new/page.js"),
    await readSource("../app/family/calendar/events/[id]/edit/page.js"),
  ].join("\n");

  for (const title of [
    "로운이와 나 - KaosGdd",
    "메모장 - KaosGdd",
    "로운이 시간표 - KaosGdd",
    "일정 추가 - KaosGdd",
    "일정 수정 - KaosGdd",
  ]) {
    assert.ok(pageSources.includes(title), `${title} should be used as a Family page title`);
  }

  for (const oldTitle of ["우짜노우짤꼬", "모라노", "뭔날이고", "로니 - KaosGdd"]) {
    assert.ok(!pageSources.includes(oldTitle), `${oldTitle} should not remain in Family page metadata`);
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
  const familyFontsCss = await readSource("../app/styles/family-fonts.css");

  assert.ok(familyCss.includes(".familyPage"));
  assert.ok(familyCss.includes("font-family"));
  assert.ok(familyCss.includes("Apple SD Gothic Neo"));
  assert.ok(familyCss.includes("Noto Sans KR"));
  assert.ok(familyCss.includes("system-ui"));
  assert.ok(familyFontsCss.includes('font-family: "Lotteria"'));
  assert.ok(familyFontsCss.includes("LOTTERIADDAG.woff2"));
  for (const removedFont of ["Hyunok", "현옥", "GangwonEducationHyunokSam"]) {
    assert.ok(!familyCss.includes(removedFont), `${removedFont} should not remain in Family CSS`);
  }
});

test("family dashboard and calendar expose standard labels", async () => {
  const dashboardSource = await readSource("../app/family/FamilyDashboardClient.js");
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const calendarDataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const globalsCss = await readSource("../app/globals.css");

  for (const label of ["달력", "할 일", "로운이 시간표", "일정", "+ 일정"]) {
    assert.ok((dashboardSource + calendarSource + rounySource).includes(label), `${label} should appear in dashboard/calendar UI`);
  }
  for (const oldLabel of ["로니", "로우니", "뭐라꼬?", "은제?", "모하꼬?"]) {
    assert.ok(!(dashboardSource + calendarSource + rounySource).includes(oldLabel), `${oldLabel} should not appear in visible Family sources`);
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
  assert.ok(globalsCss.includes("family-rouny-templates.css"));
});

test("family polish keeps the baseline compact and overflow-safe", async () => {
  const polishCss = await readSource("../app/styles/family-polish.css");
  const rounyCss = await readSource("../app/styles/family-rouny-templates.css");

  assert.match(polishCss, /\.familyPage\s*\{[\s\S]*?--family-page-max:\s*var\(--app-column-max-width\);[\s\S]*?width:\s*min\(calc\(100% - \(var\(--app-column-edge-padding\) \* 2\)\), var\(--family-page-max\)\);[\s\S]*?max-width:\s*var\(--family-page-max\);[\s\S]*?box-sizing:\s*border-box;[\s\S]*?font-size:\s*14px;/);
  assert.match(polishCss, /\.familyCard,[\s\S]*?\.familyDashboard,[\s\S]*?\.familyCalendar,[\s\S]*?\.familyCalendarFormPage,[\s\S]*?\.familyTimetable,[\s\S]*?\.familyStream,[\s\S]*?\.familyTaskForm,[\s\S]*?\.familyDoneTasks\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/);
  assert.match(polishCss, /\.familyHeader\s*\{[\s\S]*?justify-content:\s*space-between;[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?min-height:\s*72px;[\s\S]*?overflow:\s*hidden;/);
  assert.match(polishCss, /\.familyLogoLink\s*\{[\s\S]*?width:\s*auto;[\s\S]*?background:\s*transparent;[\s\S]*?text-decoration:\s*none;/);
  assert.match(polishCss, /\.familyTextLogo\s*\{[\s\S]*?font-family:\s*"Lotteria"[\s\S]*?color:\s*var\(--family-highlight, #d86f98\);[\s\S]*?font-size:\s*22px;/);
  assert.ok(!polishCss.includes("familyHeaderLogo"));
  assert.match(polishCss, /\.familyHomeNav\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?margin-left:\s*auto;[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow:\s*hidden;/);
  assert.match(polishCss, /\.familyHomeNavLink\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(polishCss, /\.familyHomeNavLinkActive::after\s*\{[\s\S]*?height:\s*2px;[\s\S]*?background:\s*rgba\(216, 111, 152, 0\.72\);/);
  assert.match(polishCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyPage\s*\{[\s\S]*?width:\s*min\(calc\(100% - 16px\), var\(--family-page-max\)\);[\s\S]*?max-width:\s*var\(--family-page-max\);/);
  assert.match(polishCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyHomeNav\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?margin-left:\s*auto;/);
  assert.match(polishCss, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.familyTextLogo\s*\{[\s\S]*?font-size:\s*20px;/);
  assert.match(polishCss, /@media\s*\(max-width:\s*360px\)\s*\{[\s\S]*?\.familyTextLogo\s*\{[\s\S]*?font-size:\s*18px;/);
  assert.match(polishCss, /@media\s*\(max-width:\s*360px\)\s*\{[\s\S]*?\.familyHomeNavLink\s*\{[\s\S]*?font-size:\s*13px;/);
  assert.match(rounyCss, /\.familyRounyTemplateRow\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
  assert.match(rounyCss, /\.familyRounyTemplateActions[\s\S]*?\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(rounyCss, /overflow-wrap:\s*anywhere;/);
});
