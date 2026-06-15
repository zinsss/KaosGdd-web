import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar uses finalized standard Korean wording", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const roniSource = await readSource("../app/family/calendar/roni/FamilyRoniClient.js");
  const dataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarCss = await readSource("../app/styles/family-calendar.css");
  const polishCss = await readSource("../app/styles/family-polish.css");
  const combinedSource = `${calendarSource}\n${eventFormSource}\n${roniSource}`;

  for (const label of [
    "달력",
    "+ 일정",
    "로우니 시간표",
    "일정 옵션",
    "이번 주만 변경",
    "이번 주만 일정 취소",
    "로우니 기본 시간표도 변경",
    "되돌리기",
    "일정 이름",
    "시작",
    "끝",
    "메모",
    "저장",
    "취소",
    "삭제",
    "일정 이름을 입력해주세요.",
  ]) {
    assert.ok(combinedSource.includes(label), `${label} should appear in Family calendar sources`);
  }

  for (const value of ["kaosgdd.family.calendarItems.v1", "kaosgdd.family.defaultTimetable.v1", "kaosgdd.family.roniOverrides.v1"]) {
    assert.ok(dataSource.includes(value));
  }
  assert.ok(calendarCss.includes(".familyCalendarItemRoni"));
  assert.ok(calendarCss.includes(".familyCalendarItemDated"));
  assert.ok(polishCss.includes(".familyCalendarItemRoni.familyTimetableEntryPink"));
  assert.ok(polishCss.includes(".familyCalendarItemDated"));

  for (const oldString of ["고치까", "치아라", "다했데이", "도로묵이다", "고마하자", "이번 주만 치아라", "로니도 바꾸기", "다시 보이기"]) {
    assert.ok(!combinedSource.includes(oldString), `${oldString} should not remain in Family calendar UI`);
  }
});
