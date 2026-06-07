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
  assert.match(source, /params\.set\("date", nextDate\);/);
  assert.match(source, /router\.replace\(qs \? `\$\{pathname\}\?\$\{qs\}` : pathname, \{ scroll: false \}\);/);
  assert.match(source, /onClick=\{\(\) => updateSelectedDate\(d\)\}/);
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

  assert.match(source, /\/api\/weather\/dayparts\?location=/);
  assert.match(source, /weatherDaypartsAvailable && weatherDayparts\.length > 0/);
  assert.match(source, /eventDaypartRow/);
  assert.match(source, /weatherDaypartsReason/);
  assert.match(source, /Weather info not available\./);
});

test("daily month-cell weather remains in calendar cell rendering", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");

  assert.match(source, /\/api\/weather\/daily\?location=/);
  assert.match(source, /calendarDayWeatherGlyph/);
  assert.match(source, /calendarDayWeatherTemp/);
});
