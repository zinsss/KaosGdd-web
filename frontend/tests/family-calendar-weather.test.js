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

test("family calendar expanded week shows one compact weather summary row by default", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");

  assert.ok(calendarSource.includes("const [weatherExpanded, setWeatherExpanded] = useState(false);"));
  assert.ok(calendarSource.includes("setWeatherExpanded(false);"));
  assert.ok(calendarSource.includes("expanded={weatherExpanded}"));
  assert.ok(calendarSource.includes("onToggle={() => setWeatherExpanded((current) => !current)}"));
  assert.ok(calendarSource.includes("onToggle={onToggleWeather}"));

  assert.ok(weatherRowsSource.includes("const toggleGlyph = expanded ? \"▾\" : \"▸\";"));
  assert.ok(weatherRowsSource.includes("aria-expanded={expanded}"));
  assert.ok(weatherRowsSource.includes("className=\"familyCalendarWeatherSummaryRow\""));
  assert.ok(weatherRowsSource.includes("{expanded ? FAMILY_CALENDAR_DAYPART_LABELS.map"));
  assert.ok(!weatherRowsSource.includes("FAMILY_CALENDAR_DAYPART_LABELS.map((defaultLabel, index) => ("));

  assert.ok(weatherCss.includes(".familyCalendarWeatherSummaryRow"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherToggle"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherToggleLabel"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherToggleGlyph"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherLabel"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherSummary"));
  assert.ok(weatherCss.includes(".familyCalendarWeatherDaypart"));
  assert.ok(compactCss.includes(".familyCalendarTimeRow {"));
  assert.ok(compactCss.includes("grid-template-columns: var(--family-calendar-expanded-rail-width, 34px) repeat(7, minmax(0, 1fr));"));
  assert.ok(compactCss.includes("grid-template-columns: var(--family-calendar-expanded-rail-width, 28px) repeat(7, minmax(0, 1fr));"));
});

test("family calendar weather daypart rows are hidden behind local weather expansion", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherClient = await readSource("../app/lib/weather-client.js");

  assert.ok(calendarSource.includes("selectedWeekWeatherDayparts"));
  assert.ok(calendarSource.includes("weatherExpanded"));
  assert.ok(weatherRowsSource.includes("expanded = false"));
  assert.ok(weatherRowsSource.includes("onToggle = null"));
  assert.ok(weatherRowsSource.includes("{expanded ? FAMILY_CALENDAR_DAYPART_LABELS.map((defaultLabel, index) => ("));

  for (const label of ["날씨", "오전", "오후", "저녁", "밤"]) {
    assert.ok(weatherClient.includes(label) || weatherRowsSource.includes(label), `${label} should appear in Family weather UI`);
  }
});

test("family calendar weather glyph mapping avoids lowercase abbreviation output", async () => {
  const weatherClient = await readSource("../app/lib/weather-client.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");

  assert.ok(weatherClient.includes("export function formatFamilyWeatherGlyph"));
  for (const glyph of ["☀", "🌤", "☁", "🌧", "⛈", "❄", "🌙"]) {
    assert.ok(weatherClient.includes(glyph), `${glyph} should be supported by the Family weather glyph mapper`);
  }
  for (const token of ["clear", "sunny", "cloudy", "rain", "snow", "night"]) {
    assert.ok(weatherClient.includes(token), `${token} should map through the shared weather glyph helper`);
  }
  assert.ok(weatherRowsSource.includes("formatFamilyWeatherGlyph(weather?.glyph)"));
  assert.ok(!weatherRowsSource.includes("s."));
  assert.ok(!weatherRowsSource.includes("c."));
  assert.ok(!weatherRowsSource.includes("y."));
  assert.ok(!weatherRowsSource.includes("n."));
});

test("collapsed Family week no longer shows weather summaries and still counts only dated events", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");
  const globalsCss = await readSource("../app/globals.css");

  assert.ok(globalsCss.includes('@import "./styles/family-calendar-weather.css";'));
  assert.ok(calendarSource.includes("const count = datedItemsByDate[day.dateKey] || 0;"));
  assert.ok(calendarSource.includes("familyCalendarWeekDateButtonCollapsed"));
  assert.ok(calendarSource.includes('className="familyCalendarWeekDateMeta"'));
  assert.ok(calendarSource.includes('{count ? `일정 ${count}` : ""}'));
  assert.ok(!calendarSource.includes("const weather = weatherByDate.get(day.dateKey);"));
  assert.ok(!calendarSource.includes('className="familyCalendarWeekDateWeather"'));
  assert.ok(!calendarSource.includes('weather ? `${weather.min_c}/${weather.max_c}` : ""'));
  assert.ok(!calendarSource.includes('`${weather ? " · " : ""}일정 ${count}`'));

  assert.ok(weatherCss.includes(".familyCalendarWeekDateButtonCollapsed"));
  assert.ok(weatherCss.includes(".familyCalendarWeekDateMeta"));
  assert.ok(!weatherCss.includes(".familyCalendarWeekDateWeather"));
});

test("family calendar weather rows guard missing daypart entries before reading glyphs", async () => {
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");

  assert.ok(weatherRowsSource.includes("function hasDaypartWeather(item)"));
  assert.ok(weatherRowsSource.includes("if (!item) return false;"));
  assert.ok(weatherRowsSource.includes("{hasDaypartWeather(weather) ? ("));
  assert.ok(!weatherRowsSource.includes('weather?.glyph || weather?.temp_min_c !== "" || weather?.temp_max_c !== "" ? ('));
});

test("existing Family all-day event source coverage remains intact", async () => {
  const editTestSource = await readSource("./family-calendar-edit.test.js");

  assert.ok(
    editTestSource.includes("family calendar all-day marker defaults the form and renders a top all-day row"),
    "existing all-day event test should remain present",
  );
});
