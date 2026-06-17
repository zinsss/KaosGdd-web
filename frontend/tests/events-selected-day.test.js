import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("events page defaults selected date from date query or today", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");

  assert.match(source, /const dateParam = searchParams\?\.get\("date"\);/);
  assert.match(source, /const initialSelectedDate = isValidYmd\(dateParam\) \? dateParam : currentYmd;/);
  assert.match(source, /setMonth\(monthValueForDate\(initialSelectedDate\)\);/);
  assert.match(source, /setSelectedDate\(initialSelectedDate\);/);
});

test("calendar day click updates selected date URL state", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");

  assert.match(source, /function updateSelectedDate\(nextDate/);
  assert.match(source, /if \(nextDate === todayYmd\) \{/);
  assert.match(source, /params\.delete\("date"\);/);
  assert.match(source, /params\.set\("date", nextDate\);/);
  assert.match(source, /router\.replace\(qs \? `\$\{pathname\}\?\$\{qs\}` : pathname, \{ scroll: false \}\);/);
  assert.match(source, /onClick=\{\(\) => updateSelectedDate\(d\)\}/);
});

test("calendar distinguishes today, selected, and today-selected states", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/styles/events.css", import.meta.url), "utf8");

  assert.match(source, /const isSelected = selectedDate === d;/);
  assert.match(source, /const isToday = todayYmd === d;/);
  assert.match(source, /isSelected && !isToday \? " eventCalCellSelectedOnly" : ""/);
  assert.match(source, /isToday && !isSelected \? " eventCalCellTodayOnly" : ""/);
  assert.match(source, /isSelected && isToday \? " eventCalCellSelectedToday" : ""/);
  assert.match(css, /\.eventCalCellTodayOnly\s*\{/);
  assert.match(css, /\.eventCalCellSelectedOnly\s*\{/);
  assert.match(css, /\.eventCalCellSelectedToday\s*\{/);
  assert.match(css, /\.eventCalCellToday::after\s*\{/);
});

test("events page renders Today button that selects today", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/styles/events.css", import.meta.url), "utf8");

  assert.match(source, /className="button compactButton buttonToneNeutral eventTodayButton"/);
  assert.match(source, /if \(todayYmd\) updateSelectedDate\(todayYmd\);/);
  assert.match(source, />\s*Today\s*<\/button>/);
  assert.match(css, /\.eventTodayButton\s*\{/);
});

test("events page renders selected-day panel instead of full-month event list", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");

  assert.match(source, /eventSelectedDayPanel/);
  assert.match(source, /Selected day •/);
  assert.match(source, /selectedDayEvents\.length === 0/);
  assert.match(source, /No events for this day\./);
  assert.doesNotMatch(source, /monthEventsByDate/);
  assert.doesNotMatch(source, /eventMonthGroups/);
});

test("selected-day weather dayparts render available and unavailable states", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");
  const weatherClient = await readFile(new URL("../app/lib/weather-client.js", import.meta.url), "utf8");

  assert.match(source, /fetchWeatherDayparts\(\{ location: weatherLocation, date: selectedDate \}\)/);
  assert.match(weatherClient, /\/api\/weather\/dayparts\?location=/);
  assert.match(source, /weatherDaypartsAvailable && weatherDayparts\.length > 0/);
  assert.match(source, /eventDaypartRow/);
  assert.match(source, /weatherDaypartsReason/);
  assert.match(source, /Weather info not available\./);
});

test("daily month-cell weather remains in calendar cell rendering", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");
  const weatherClient = await readFile(new URL("../app/lib/weather-client.js", import.meta.url), "utf8");

  assert.match(source, /fetchWeatherDaily\(\{ location: weatherLocation, startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.match(weatherClient, /\/api\/weather\/daily\?location=/);
  assert.match(source, /calendarDayWeatherGlyph/);
  assert.match(source, /calendarDayWeatherTemp/);
});
