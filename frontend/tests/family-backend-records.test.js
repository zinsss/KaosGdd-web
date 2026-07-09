import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Family modules use backend records instead of browser-only storage", async () => {
  const storeSource = await readSource("../app/family/familyBackendStore.js");
  const routeSource = await readSource("../app/api/family/records/[key]/route.js");
  const calendarDataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const caregiverSource = await readSource("../app/family/calendar/caregiver/FamilyCaregiverMonthlyReviewClient.js");
  const memoSource = await readSource("../app/family/FamilyPageClient.js");
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const backendSource = await readSource("../../backend/app/main.py");

  assert.ok(storeSource.includes("/api/family/records/"));
  assert.ok(storeSource.includes("persistFamilyRecord(recordKey, fallbackValue);"), "missing backend records should migrate local fallback data once");
  assert.ok(routeSource.includes("/family/records/"));
  assert.ok(backendSource.includes('@app.get("/family/records/{record_key}")'));
  assert.ok(backendSource.includes('@app.put("/family/records/{record_key}")'));

  for (const name of [
    "fetchFamilyCalendarItems",
    "persistFamilyCalendarItems",
    "fetchFamilyRounState",
    "persistFamilyRounState",
    "fetchFamilyRounyOverrides",
    "persistFamilyRounyOverrides",
    "fetchFamilyCaregiverHours",
    "persistFamilyCaregiverHours",
    "fetchFamilyCaregiverHourlyWage",
    "fetchFamilyCaregiverMonthlySettings",
    "persistFamilyCaregiverMonthlySettings",
  ]) {
    assert.ok(calendarDataSource.includes(`export ${name.startsWith("persistFamilyRounState") ? "function" : "async function"} ${name}`), `${name} should be exported`);
  }

  for (const source of [calendarSource, eventFormSource, rounySource, caregiverSource, memoSource, timetableSource]) {
    assert.ok(source.includes("fetchFamily") || source.includes("fetchMessages") || source.includes("fetchTimetableEntries"));
    assert.ok(source.includes("persistFamily") || source.includes("persistMessages") || source.includes("persistTimetableEntries"));
  }

  assert.ok(calendarDataSource.includes("return loadFamily"));
  assert.ok(calendarDataSource.includes("saveFamily"));
});
