import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const OLD_FAMILY_STRINGS = [
  "고치까",
  "치아라",
  "다했데이",
  "도로묵이다",
  "고마하자",
  "이번 주만 치아라",
  "로니도 바꾸기",
  "우야노 우야꼬",
  "모하꼬?",
  "뭐라꼬?",
  "Hyunok",
  "현옥",
  "GangwonEducationHyunokSam",
];

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family shared header uses finalized standard tab wording and unchanged routes", async () => {
  const headerSource = await readSource("../app/family/FamilyHeader.js");

  assert.ok(headerSource.includes("가족"));
  for (const label of ["메모장", "달력", "할 일"]) assert.ok(headerSource.includes(label));
  for (const route of ["/family/memo", "/family/calendar", "/family"]) assert.ok(headerSource.includes(route));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!headerSource.includes(oldString));
});

test("family memo page uses finalized title and checklist glyph", async () => {
  const memoSource = await readSource("../app/family/FamilyPageClient.js");

  assert.ok(memoSource.includes('aria-label="메모장"'));
  assert.ok(memoSource.includes("<h2>메모장</h2>"));
  assert.ok(memoSource.includes(""));
  for (const label of ["수정", "삭제", "저장", "취소"]) assert.ok(memoSource.includes(label));
  for (const oldString of OLD_FAMILY_STRINGS) assert.ok(!memoSource.includes(oldString));
});

test("family font no longer exposes Hyunok and remains Family-scoped", async () => {
  const familyCss = await readSource("../app/styles/family.css");

  assert.ok(familyCss.includes(".familyPage"));
  assert.ok(familyCss.includes("font-family"));
  assert.ok(familyCss.includes("Apple SD Gothic Neo"));
  assert.ok(familyCss.includes("Noto Sans KR"));
  assert.ok(familyCss.includes("system-ui"));
  for (const oldString of ["Hyunok", "현옥", "GangwonEducationHyunokSam"]) {
    assert.ok(!familyCss.includes(oldString));
  }
});

test("family dashboard and calendar expose standard labels", async () => {
  const dashboardSource = await readSource("../app/family/FamilyDashboardClient.js");
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const calendarDataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const globalsCss = await readSource("../app/globals.css");

  for (const label of ["달력", "할 일", "로우니 시간표", "일정", "+ 일정"]) {
    assert.ok((dashboardSource + calendarSource).includes(label));
  }
  for (const value of ["kaosgdd.family.calendarItems.v1", "kaosgdd.family.defaultTimetable.v1", "FAMILY_CALENDAR_DAY_LABELS"]) {
    assert.ok(calendarDataSource.includes(value));
  }
  assert.ok(globalsCss.includes("family-calendar.css"));
  for (const oldString of OLD_FAMILY_STRINGS) {
    assert.ok(!dashboardSource.includes(oldString));
    assert.ok(!calendarSource.includes(oldString));
  }
});
