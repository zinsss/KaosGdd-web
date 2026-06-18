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

  assert.match(weatherClient, /WEATHER_LOCATION_STORAGE_KEY/);
  assert.match(weatherClient, /kaosgdd\.weather\.location\.v1/);
  assert.match(weatherClient, /fetchWeatherDaily/);
  assert.match(weatherClient, /fetchWeatherDayparts/);
  assert.match(weatherClient, /FAMILY_CALENDAR_DAYPART_LABELS\s*=\s*\["오전",\s*"오후",\s*"저녁",\s*"밤"\]/);

  assert.match(eventsSource, /from\s+"\.\.\/lib\/weather-client"/);
  assert.match(familyCalendarSource, /from\s+"\.\.\/\.\.\/lib\/weather-client"/);
  assert.match(familyCalendarSource, /getStoredWeatherLocation/);
  assert.match(familyCalendarSource, /listenWeatherLocationChange/);

  assert.match(settingsPage, /날씨 지역/);
  assert.match(settingsPage, /WeatherLocationSettings/);
  assert.match(weatherSettings, /aria-label="날씨 지역"/);
  assert.match(weatherSettings, /DEFAULT_WEATHER_LOCATIONS\.map/);
});

test("family calendar expanded week keeps weather compact by default and renders it before all-day rows", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");

  assert.match(calendarSource, /const\s*\[weatherExpanded,\s*setWeatherExpanded\]\s*=\s*useState\(false\);/);
  assert.match(calendarSource, /setWeatherExpanded\(false\);\s*\n\s*\},\s*\[selectedWeekKey,\s*calendarMode,\s*monthDate\]\);/);
  assert.match(calendarSource, /expanded=\{weatherExpanded\}/);
  assert.match(calendarSource, /onToggle=\{\(\)\s*=>\s*setWeatherExpanded\(\(current\)\s*=>\s*!current\)\}/);
  assert.match(calendarSource, /onToggle=\{onToggleWeather\}/);

  assert.match(weatherRowsSource, /const\s+toggleGlyph\s*=\s*expanded\s*\?\s*"▾"\s*:\s*"▸";/);
  assert.match(weatherRowsSource, /aria-expanded=\{expanded\}/);
  assert.match(weatherRowsSource, /familyCalendarWeatherSummaryRow/);
  assert.match(weatherRowsSource, /\{expanded\s*\?\s*FAMILY_CALENDAR_DAYPART_LABELS\.map/);

  const weatherIndex = calendarSource.indexOf("<FamilyCalendarWeatherRows");
  const allDayIndex = calendarSource.indexOf('className="familyCalendarTimeRow familyCalendarAllDayRow"', weatherIndex);
  const timedIndex = calendarSource.indexOf('selectedWeekRows.map(([hour, dayItems]) => (', weatherIndex);
  assert.ok(weatherIndex >= 0, "expanded selected week should render weather rows");
  assert.ok(allDayIndex > weatherIndex, "all-day row should render after weather rows");
  assert.ok(timedIndex > allDayIndex, "timed rows should render after all-day rows");

  assert.match(weatherCss, /\.familyCalendarWeatherSummaryRow/);
  assert.match(weatherCss, /\.familyCalendarWeatherToggle/);
  assert.match(weatherCss, /\.familyCalendarWeatherToggleLabel/);
  assert.match(weatherCss, /\.familyCalendarWeatherToggleGlyph/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummary/);
  assert.match(weatherCss, /\.familyCalendarWeatherDaypart/);
  assert.match(weatherCss, /\.familyCalendarWeatherLabelText/);
  assert.match(compactCss, /grid-template-columns:\s*var\(--family-calendar-expanded-rail-width,\s*34px\)\s*repeat\(7,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(compactCss, /grid-template-columns:\s*var\(--family-calendar-expanded-rail-width,\s*28px\)\s*repeat\(7,\s*minmax\(0,\s*1fr\)\);/);
});

test("family calendar weather daypart rows stay behind local expansion state", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherClient = await readSource("../app/lib/weather-client.js");

  assert.match(calendarSource, /selectedWeekWeatherDayparts/);
  assert.match(calendarSource, /weatherExpanded/);
  assert.match(weatherRowsSource, /expanded\s*=\s*false/);
  assert.match(weatherRowsSource, /onToggle\s*=\s*null/);
  assert.match(weatherRowsSource, /\{expanded\s*\?\s*FAMILY_CALENDAR_DAYPART_LABELS\.map\(\(defaultLabel, index\)\s*=>/);

  for (const label of ["날씨", "오전", "오후", "저녁", "밤"]) {
    assert.ok(weatherClient.includes(label) || weatherRowsSource.includes(label), `${label} should appear in Family weather UI`);
  }
});

test("family calendar weather formatter returns plain Korean labels in the main app font stack", async () => {
  const weatherClient = await readSource("../app/lib/weather-client.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");

  assert.match(weatherClient, /export function formatFamilyWeatherLabel/);
  assert.match(weatherClient, /export function normalizeFamilyWeatherDailyItems/);
  assert.match(weatherClient, /const FAMILY_WEATHER_LABELS = \{/);
  for (const label of ["맑음", "구름", "흐림", "비", "폭우", "눈", "밤"]) {
    assert.ok(weatherClient.includes(label), `${label} should be supported by the Family weather formatter`);
  }
  assert.doesNotMatch(weatherClient, /stringDisplayWidth|padFamilyWeatherLabel|repeat\(4 - displayWidth\)/);
  assert.match(weatherClient, /function familyWeatherDaypartSource\(item\)/);
  assert.match(weatherClient, /return item\?\.condition \|\| item\?\.summary \|\| "";/);
  assert.match(weatherClient, /weatherLabel:\s*formatFamilyWeatherLabel\(item\?\.glyph,\s*familyWeatherLabelSource\(item\)\)/);
  assert.match(weatherClient, /weatherLabel:\s*formatFamilyWeatherLabel\(item\.glyph,\s*familyWeatherDaypartSource\(item\)\)/);

  assert.match(weatherRowsSource, /weather\?\.weatherLabel \|\| formatFamilyWeatherLabel\(weather\?\.glyph,\s*weather\?\.label \|\| weather\?\.condition \|\| weather\?\.summary\)/);
  assert.match(weatherRowsSource, /weather\?\.weatherLabel \|\| formatFamilyWeatherLabel\(weather\?\.glyph,\s*weather\?\.condition \|\| weather\?\.summary\)/);
  assert.match(weatherRowsSource, /formatWeatherText\(weatherLabel,\s*formatWeatherRange\(weather\)\)/);
  assert.match(weatherRowsSource, /formatWeatherText\(weatherLabel,\s*formatDaypartRange\(weather\)\)/);
  assert.doesNotMatch(weatherRowsSource, /밤\s*18-20/);

  assert.match(weatherCss, /font-family:\s*var\(--font-ui,\s*"Sarasa Gothic Mono",\s*"Noto Sans CJK KR",\s*"Noto Sans KR",\s*sans-serif\);/);
  assert.doesNotMatch(weatherCss, /white-space:\s*pre;/);
  assert.doesNotMatch(weatherCss, /Apple Color Emoji|Segoe UI Emoji|Noto Color Emoji|Nerd Font/);
  assert.doesNotMatch(weatherRowsSource, /\bfamilyCalendarWeatherGlyph\b/);
  assert.doesNotMatch(weatherRowsSource, /\bs\./);
  assert.doesNotMatch(weatherRowsSource, /\bc\./);
  assert.doesNotMatch(weatherRowsSource, /\by\./);
  assert.doesNotMatch(weatherRowsSource, /\bn\./);
});

test("family calendar client normalizes daily weather labels before rendering", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");

  assert.match(calendarSource, /normalizeFamilyWeatherDailyItems/);
  assert.match(calendarSource, /setWeatherItems\(normalizeFamilyWeatherDailyItems\(Array\.isArray\(data\.items\) \? data\.items : \[\]\)\)/);
  assert.match(calendarSource, /dayparts\.some\(\(item\) => item\.weatherLabel \|\| item\.temp_min_c !== "" \|\| item\.temp_max_c !== ""\)/);
});

test("collapsed Family week no longer shows weather summaries and still counts only dated events", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");
  const globalsCss = await readSource("../app/globals.css");

  assert.match(globalsCss, /@import\s+"\.\/styles\/family-calendar-weather\.css";/);
  assert.match(calendarSource, /const\s+count\s*=\s*datedItemsByDate\[day\.dateKey\]\s*\|\|\s*0;/);
  assert.match(calendarSource, /familyCalendarWeekDateButtonCollapsed/);
  assert.match(calendarSource, /className="familyCalendarWeekDateMeta"/);
  assert.match(calendarSource, /\{count \? `일정 \$\{count\}` : ""\}/);
  assert.doesNotMatch(calendarSource, /const\s+weather\s*=\s*weatherByDate\.get\(day\.dateKey\);/);
  assert.doesNotMatch(calendarSource, /familyCalendarWeekDateWeather/);
  assert.doesNotMatch(calendarSource, /weather \? `\$\{weather\.min_c\}\/\$\{weather\.max_c\}` : ""/);

  assert.match(weatherCss, /\.familyCalendarWeekDateButtonCollapsed/);
  assert.match(weatherCss, /\.familyCalendarWeekDateMeta/);
  assert.doesNotMatch(weatherCss, /\.familyCalendarWeekDateWeather/);
});

test("family calendar weather rows guard missing daypart entries before reading labels", async () => {
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");

  assert.match(weatherRowsSource, /function hasDaypartWeather\(item\)/);
  assert.match(weatherRowsSource, /if \(!item\) return false;/);
  assert.match(weatherRowsSource, /Boolean\(item\.weatherLabel\)/);
  assert.match(weatherRowsSource, /\{hasDaypartWeather\(weather\) \? \(/);
});

test("existing Family all-day event source coverage remains intact", async () => {
  const editTestSource = await readSource("./family-calendar-edit.test.js");

  assert.ok(
    editTestSource.includes("family calendar all-day marker defaults the form and renders a top all-day row"),
    "existing all-day event test should remain present",
  );
});
