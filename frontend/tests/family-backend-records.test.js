import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Family modules use backend records instead of browser-only storage", async () => {
  const storeSource = await readSource("../app/family/familyBackendStore.js");
  const notesRouteSource = await readSource("../app/api/family/notes/route.js");
  const eventsRouteSource = await readSource("../app/api/family/events/route.js");
  const timetablesRouteSource = await readSource("../app/api/family/timetables/route.js");
  const caregiverRouteSource = await readSource("../app/api/family/caregiver/days/route.js");
  const linksRouteSource = await readSource("../app/api/family/links/route.js");
  const calendarDataSource = await readSource("../app/family/calendar/familyCalendarData.js");
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const polishCss = await readSource("../app/styles/family-polish.css");
  const eventFormSource = await readSource("../app/family/calendar/events/FamilyCalendarEventFormClient.js");
  const rounySource = await readSource("../app/family/calendar/rouny/FamilyRounyClient.js");
  const caregiverSource = await readSource("../app/family/calendar/caregiver/FamilyCaregiverMonthlyReviewClient.js");
  const memoSource = await readSource("../app/family/FamilyPageClient.js");
  const timetableSource = await readSource("../app/family/FamilyTimetable.js");
  const backendSource = await readSource("../../backend/app/main.py");

  assert.ok(storeSource.includes("fetchFamilyModule"));
  assert.ok(storeSource.includes("fetchFamilyModuleWithQuery"));
  assert.ok(storeSource.includes("persistFamilyModule"));
  assert.ok(!storeSource.includes("persistFamilyRecord(recordKey, fallbackValue);"));
  assert.ok(notesRouteSource.includes("/family/notes"));
  assert.ok(eventsRouteSource.includes("/family/events"));
  assert.ok(eventsRouteSource.includes('url.searchParams.get("start_date")'));
  assert.ok(eventsRouteSource.includes('url.searchParams.get("end_date")'));
  assert.ok(timetablesRouteSource.includes("/family/timetables"));
  assert.ok(caregiverRouteSource.includes("/family/caregiver/days"));
  assert.ok(linksRouteSource.includes("/family/links"));
  for (const path of ["/family/notes", "/family/events", "/family/timetables", "/family/caregiver/days", "/family/settings/{setting_key}", "/family/links"]) {
    assert.ok(backendSource.includes(path), `${path} backend route should exist`);
  }

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

  assert.ok(calendarDataSource.includes('fetchFamilyModuleWithQuery("events", "events", { start_date: startDate, end_date: endDate }, [])'));
  assert.ok(calendarDataSource.includes(".filter((item) => item && !item.readOnly && !item.systemEvent);"));
  assert.ok(calendarSource.includes("fetchFamilyCalendarItems({ startDate: weatherStart, endDate: weatherEnd })"));
  assert.ok(calendarSource.includes("const dragEnabledItem = !item.readOnly && (editItem || allDayEditItem);"));
  assert.ok(calendarSource.includes('item.eventClass === "public-holiday" ? " familyCalendarPublicHolidayItem" : ""'));
  assert.match(polishCss, /\.familyCalendarPublicHolidayItem\.familyCalendarItemDated\s*\{[\s\S]*?color:\s*#d86f98;/);
  assert.ok(calendarDataSource.includes('fetchFamilyModule("timetables"'));
  assert.ok(calendarDataSource.includes('fetchFamilyModule("caregiver/days"'));
});
