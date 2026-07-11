import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  sharedWeatherDailyFromPayload,
  sharedWeatherDaypartsFromPayload,
} from "../app/lib/weather-client.js";

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

  assert.match(source, /fetchSharedWeather\(\{ startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.match(source, /sharedWeatherDaypartsFromPayload\(sharedWeather, \{ location: weatherLocation, date: selectedDate \}\)/);
  assert.match(weatherClient, /fetchSharedWeather/);
  assert.match(weatherClient, /function sharedWeatherRequestUrl\(\{ startDate = "", endDate = "" \} = \{\}\)/);
  assert.doesNotMatch(source, /fetchWeatherDayparts\(\{ location: weatherLocation, date: selectedDate \}\)/);
  assert.doesNotMatch(weatherClient, /\/api\/weather\/dayparts\?location=/);
  assert.match(source, /weatherDaypartsAvailable && weatherDayparts\.length > 0/);
  assert.match(source, /eventDaypartRow/);
  assert.match(source, /weatherDaypartsReason/);
  assert.match(source, /Weather info not available\./);
});

test("daily month-cell weather remains in calendar cell rendering", async () => {
  const source = await readFile(new URL("../app/events/EventsPageClient.js", import.meta.url), "utf8");
  const weatherClient = await readFile(new URL("../app/lib/weather-client.js", import.meta.url), "utf8");

  assert.match(source, /fetchSharedWeather\(\{ startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.match(source, /sharedWeatherDailyFromPayload\(sharedWeather, \{ location: weatherLocation, startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.match(weatherClient, /fetchSharedWeather/);
  assert.match(weatherClient, /function sharedWeatherRequestUrl\(\{ startDate = "", endDate = "" \} = \{\}\)/);
  assert.doesNotMatch(source, /fetchWeatherDaily\(\{ location: weatherLocation, startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.doesNotMatch(weatherClient, /\/api\/weather\/daily\?location=/);
  assert.match(source, /calendarDayWeatherGlyph/);
  assert.match(source, /calendarDayWeatherTemp/);
});

test("main events can slice cold shared weather payload without Family calendar priming", async () => {
  const sharedPayload = {
    ok: true,
    locations: [
      {
        id: "pohang",
        label: "포항",
        stale: false,
        weather: {
          daily: [
            { date: "2026-06-01", glyph: "☀", min_c: 18, max_c: 27 },
            { date: "2026-06-02", glyph: "🌧", min_c: 19, max_c: 24 },
          ],
          dayparts: {
            "2026-06-02": [
              { label: "Morning", glyph: "🌧", temp_min_c: 19, temp_max_c: 21 },
            ],
          },
        },
      },
    ],
  };

  const daily = sharedWeatherDailyFromPayload(sharedPayload, {
    location: "pohang",
    startDate: "2026-06-02",
    endDate: "2026-06-02",
  });
  assert.equal(daily.ok, true);
  assert.deepEqual(daily.items, [{ date: "2026-06-02", glyph: "🌧", min_c: 19, max_c: 24 }]);

  const dayparts = sharedWeatherDaypartsFromPayload(sharedPayload, {
    location: "pohang",
    date: "2026-06-02",
  });
  assert.equal(dayparts.ok, true);
  assert.equal(dayparts.weather_dayparts_available, true);
  assert.deepEqual(dayparts.weather_dayparts, [
    { label: "Morning", glyph: "🌧", temp_min_c: 19, temp_max_c: 21 },
  ]);
});
