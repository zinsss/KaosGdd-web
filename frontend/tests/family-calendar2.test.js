import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar2 is a separate main-events-style Family month view", async () => {
  const pageSource = await readSource("../app/family/calendar2/page.js");
  const clientSource = await readSource("../app/family/calendar2/FamilyCalendar2Client.js");
  const headerSource = await readSource("../app/family/FamilyHeader.js");
  const proxySource = await readSource("../proxy.js");
  const globalsSource = await readSource("../app/globals.css");
  const cssSource = await readSource("../app/styles/family-calendar2.css");

  assert.ok(pageSource.includes("FamilyCalendar2Client"));
  assert.ok(pageSource.includes("달력2 - KaosGdd"));
  assert.ok(pageSource.includes('<FamilyHeader active="calendar2" />'));
  assert.ok(headerSource.includes('label: "달력2"'));
  assert.ok(headerSource.includes('familyHref: "/calendar2"'));
  assert.ok(headerSource.includes('mainHref: "/family/calendar2"'));
  assert.ok(proxySource.includes('"/calendar2"'));
  assert.ok(proxySource.includes('if (pathname === "/family/calendar2") return "/calendar2";'));
  assert.ok(globalsSource.includes('@import "./styles/family-calendar2.css";'));
  assert.ok(cssSource.includes(".familyCalendar2Grid"));
  assert.ok(cssSource.includes("grid-template-columns: repeat(7, minmax(0, 1fr));"));
  assert.match(cssSource, /\.familyCalendar2Grid,[\s\S]*?\.familyCalendar2SelectedDayPanel\s*\{[\s\S]*?font-family:\s*"Sarasa Gothic Mono"/);
  assert.match(cssSource, /\.familyCalendar2WeatherGlyph\s*\{[\s\S]*?font-family:\s*"Sarasa Gothic Mono"[\s\S]*?font-size:\s*1\.34rem;/);
  assert.match(cssSource, /\.familyCalendar2WeatherGlyph\s*\{[\s\S]*?margin-right:\s*2px;/);
  assert.match(cssSource, /\.familyCalendar2CaregiverGlyph\s*\{[\s\S]*?font-family:\s*"Sarasa Gothic Mono"/);
  assert.match(cssSource, /\.familyCalendar2SelectedWeatherGlyph\s*\{[\s\S]*?font-family:\s*"Sarasa Gothic Mono"/);

  assert.ok(clientSource.includes("fetchFamilyCalendarItems"));
  assert.ok(clientSource.includes("fetchFamilyTasks"));
  assert.ok(clientSource.includes("fetchFamilyCaregiverHours"));
  assert.ok(clientSource.includes("fetchSharedWeather"));
  assert.ok(clientSource.includes("sharedWeatherDailyFromPayload"));
  assert.ok(clientSource.includes("sharedWeatherDaypartsFromPayload"));
  assert.ok(clientSource.includes("formatEventCountGlyph"));
  assert.ok(clientSource.includes("taskMatchesDate"));
  assert.ok(clientSource.includes("formatFamilyTaskDueDate"));
  assert.ok(clientSource.includes("formatFamilyCaregiverHours"));
  assert.ok(clientSource.includes("calculateFamilyCaregiverHours(caregiverHoursByDate[dateKey]) > 0"));
  assert.ok(clientSource.includes("familyCalendar2CaregiverGlyph"));
  assert.ok(clientSource.includes("󱁷"));
  assert.ok(clientSource.includes("이모"));
  assert.ok(!clientSource.includes("familyCalendar2CaregiverLine"));
  assert.ok(!cssSource.includes(".familyCalendar2CaregiverLine"));
  assert.ok(clientSource.includes("할일"));
  assert.ok(clientSource.includes("일정"));
  assert.ok(!clientSource.includes("fetchFamilyRounState"));
  assert.ok(!clientSource.includes("resolveFamilyRounPlanForDate"));
  assert.ok(!clientSource.includes("FamilyCalendarWeatherRows"));
});
