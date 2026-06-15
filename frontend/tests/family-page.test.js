import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family shared header uses finalized tab wording and routes", async () => {
  const headerSource = await readSource("../app/family/FamilyHeader.js");

  for (const label of ["메모장", "달력", "할 일"]) {
    assert.ok(headerSource.includes(label), `${label} should be in the Family header`);
  }
  for (const route of ["/family/memo", "/family/calendar", "/family"]) {
    assert.ok(headerSource.includes(route), `${route} should remain unchanged`);
  }
  for (const oldLabel of ["모하꼬?", "뭐라꼬?", "은제?", "모라노", "대시보드"]) {
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
