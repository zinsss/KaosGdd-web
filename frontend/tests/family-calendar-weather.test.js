import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar reuses the shared KaosGdd weather helper and settings", async () => {
  const weatherClient = await readSource("../app/lib/weather-client.js");
  const eventsSource = await readSource("../app/events/EventsPageClient.js");
  const familyCalendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const settingsPage = await readSource("../app/settings/page.js");
  const weatherSettings = await readSource("../components/settings/WeatherLocationSettings.js");

  assert.ok(weatherClient.includes("WEATHER_LOCATION_STORAGE_KEY"));
  assert.ok(weatherClient.includes("kaosgdd.weather.location.v1"));
  assert.ok(weatherClient.includes("fetchWeatherDaily"));
  assert.ok(weatherClient.includes("fetchWeatherDayparts"));
  assert.ok(weatherClient.includes('FAMILY_CALENDAR_DAYPART_LABELS = ["오전", "오후", "저녁", "밤"]'));

  assert.ok(eventsSource.includes('from "../lib/weather-client"'));
  assert.ok(familyCalendarSource.includes('from "../../lib/weather-client"'));
  assert.ok(familyCalendarSource.includes("getStoredWeatherLocation"));
  assert.ok(familyCalendarSource.includes("listenWeatherLocationChange"));

  assert.ok(settingsPage.includes("날씨 지역"));
  assert.ok(settingsPage.includes("WeatherLocationSettings"));
  assert.ok(weatherSettings.includes('aria-label="날씨 지역"'));
  assert.ok(weatherSettings.includes("DEFAULT_WEATHER_LOCATIONS.map"));
});

test("family calendar renders weather rows before all-day events and before time slots", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherClient = await readSource("../app/lib/weather-client.js");

  assert.ok(calendarSource.includes("FamilyCalendarWeatherRows"));
  assert.ok(calendarSource.includes("weatherByDate"));
  assert.ok(calendarSource.includes("weatherDaypartsByDate"));

  const editWeatherIndex = calendarSource.indexOf("<FamilyCalendarWeatherRows");
  const allDayIndex = calendarSource.indexOf('className="familyCalendarTimeRow familyCalendarAllDayRow"', editWeatherIndex);
  const firstTimedRowIndex = calendarSource.indexOf('selectedWeekRows.map(([hour, dayItems]) => (', editWeatherIndex);
  assert.ok(editWeatherIndex >= 0, "weather rows should render in the expanded selected week");
  assert.ok(allDayIndex > editWeatherIndex, "all-day row should render after weather rows");
  assert.ok(firstTimedRowIndex > editWeatherIndex, "timed rows should render after weather rows");

  assert.ok(weatherRowsSource.includes("FAMILY_CALENDAR_DAYPART_LABELS"));
  assert.ok(weatherRowsSource.includes("defaultLabel"));

  for (const label of ["날씨"]) {
    assert.ok(weatherRowsSource.includes(label), `${label} should appear in weather rows`);
  }
  for (const label of ["오전", "오후", "저녁", "밤"]) {
    assert.ok(weatherClient.includes(label), `${label} should be defined in shared daypart labels`);
  }
});

test("family calendar weather rows guard missing daypart entries before reading glyphs", async () => {
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");

  assert.ok(weatherRowsSource.includes("function hasDaypartWeather(item)"));
  assert.ok(weatherRowsSource.includes("if (!item) return false;"));
  assert.ok(weatherRowsSource.includes("{hasDaypartWeather(weather) ? ("));
  assert.ok(!weatherRowsSource.includes("weather?.glyph || weather?.temp_min_c !== \"\" || weather?.temp_max_c !== \"\" ? ("));
});

test("collapsed Family week shows compact weather summaries and counts only dated events", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");
  const globalsCss = await readSource("../app/globals.css");

  assert.ok(globalsCss.includes('@import "./styles/family-calendar-weather.css";'));
  assert.ok(calendarSource.includes("const weather = weatherByDate.get(day.dateKey);"));
  assert.ok(calendarSource.includes("const count = datedItemsByDate[day.dateKey] || 0;"));
  assert.ok(calendarSource.includes("familyCalendarWeekDateButtonCollapsed"));
  assert.ok(calendarSource.includes('className="familyCalendarWeekDateWeather"'));
  assert.ok(calendarSource.includes('className="familyCalendarWeekDateMeta"'));
  assert.ok(calendarSource.includes('weather ? `${weather.min_c}/${weather.max_c}` : ""'));
  assert.ok(calendarSource.includes('`${weather ? " · " : ""}일정 ${count}`'));

  assert.ok(weatherCss.includes(".familyCalendarWeekDateButtonCollapsed"));
  assert.ok(weatherCss.includes(".familyCalendarWeekDateWeather"));
  assert.ok(weatherCss.includes(".familyCalendarWeekDateMeta"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherRow"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherSummaryRow"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherLabel"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherSlot"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherSummary"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherDaypart"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherGlyph"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherTemp"));
});

test("existing Family all-day event source coverage remains intact", async () => {
  const editTestSource = await readSource("./family-calendar-edit.test.js");

  assert.ok(
    editTestSource.includes("family calendar all-day marker defaults the form and renders a top all-day row"),
    "existing all-day event test should remain present",
  );
});
