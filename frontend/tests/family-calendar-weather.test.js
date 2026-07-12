import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  clearSharedWeatherRequestCache,
  fetchWeatherDaily,
  fetchWeatherDayparts,
  normalizeSharedWeatherPayload,
  sharedWeatherDailyFromPayload,
  sharedWeatherDaypartsFromPayload,
} from "../app/lib/weather-client.js";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family calendar reuses the shared KaosGdd weather helper and settings", async () => {
  const weatherClient = await readSource("../app/lib/weather-client.js");
  const eventsSource = await readSource("../app/events/EventsPageClient.js");
  const familyCalendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const sharedWeatherRoute = await readSource("../app/api/weather/route.js");
  const settingsPage = await readSource("../app/settings/page.js");
  const weatherSettings = await readSource("../components/settings/WeatherLocationSettings.js");

  assert.match(weatherClient, /WEATHER_LOCATION_STORAGE_KEY/);
  assert.match(weatherClient, /kaosgdd\.weather\.location\.v1/);
  assert.match(weatherClient, /fetchWeatherDaily/);
  assert.match(weatherClient, /fetchWeatherDayparts/);
  assert.match(weatherClient, /fetchSharedWeather/);
  assert.match(weatherClient, /sharedWeatherDailyFromPayload/);
  assert.match(weatherClient, /sharedWeatherDaypartsFromPayload/);
  assert.match(weatherClient, /normalizeSharedWeatherPayload/);
  assert.match(weatherClient, /function sharedWeatherRequestUrl\(\{ startDate = "", endDate = "" \} = \{\}\)/);
  assert.match(weatherClient, /params\.set\("start_date", startDate\)/);
  assert.match(weatherClient, /params\.set\("end_date", endDate\)/);
  assert.match(weatherClient, /return query \? `\/api\/weather\?\$\{query\}` : "\/api\/weather";/);
  assert.doesNotMatch(weatherClient, /\/api\/weather\/daily/);
  assert.doesNotMatch(weatherClient, /\/api\/weather\/dayparts/);
  assert.match(weatherClient, /FAMILY_CALENDAR_DAYPART_LABELS\s*=\s*\["오전",\s*"오후",\s*"저녁",\s*"밤"\]/);

  assert.match(eventsSource, /from\s+"\.\.\/lib\/weather-client"/);
  assert.match(eventsSource, /fetchSharedWeather/);
  assert.match(eventsSource, /sharedWeatherDailyFromPayload/);
  assert.match(eventsSource, /sharedWeatherDaypartsFromPayload/);
  assert.doesNotMatch(eventsSource, /fetchWeatherDaily\(\{ location: weatherLocation/);
  assert.doesNotMatch(eventsSource, /fetchWeatherDayparts\(\{ location: weatherLocation/);
  assert.match(familyCalendarSource, /from\s+"\.\.\/\.\.\/lib\/weather-client"/);
  assert.match(familyCalendarSource, /fetchSharedWeather/);
  assert.match(familyCalendarSource, /sharedWeatherDailyFromPayload/);
  assert.match(familyCalendarSource, /sharedWeatherDaypartsFromPayload/);
  assert.doesNotMatch(familyCalendarSource, /fetchWeatherDaily\(\{ location: weatherLocation/);
  assert.doesNotMatch(familyCalendarSource, /fetchWeatherDayparts\(\{ location: weatherLocation/);
  assert.match(familyCalendarSource, /getStoredWeatherLocation/);
  assert.match(familyCalendarSource, /listenWeatherLocationChange/);
  assert.match(sharedWeatherRoute, /url\.searchParams\.get\("start_date"\)/);
  assert.match(sharedWeatherRoute, /url\.searchParams\.get\("end_date"\)/);
  assert.match(sharedWeatherRoute, /base \+ "\/api\/weather" \+ suffix/);

  assert.match(settingsPage, /날씨 지역/);
  assert.match(settingsPage, /WeatherLocationSettings/);
  assert.match(weatherSettings, /aria-label="날씨 지역"/);
  assert.match(weatherSettings, /fetchSharedWeather/);
  assert.match(weatherSettings, /normalizeWeatherLocations/);
  assert.doesNotMatch(weatherSettings, /DEFAULT_WEATHER_LOCATIONS\.map/);
});

test("family calendar slices selected-week weather from one shared cache payload", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const sharedPayload = {
    ok: true,
    locations: [
      {
        id: "pohang",
        label: "포항",
        stale: false,
        weather: {
          daily: [
            { date: "2026-06-21", glyph: "☁", condition: "cloudy", min_c: 17, max_c: 28 },
            { date: "2026-06-22", glyph: "🌧", condition: "rain", min_c: 21, max_c: 26 },
          ],
          dayparts: {
            "2026-06-22": [
              { label: "Morning", temp_min_c: 21, temp_max_c: 23 },
              { label: "Afternoon", temp_min_c: 24, temp_max_c: 26 },
            ],
          },
        },
      },
    ],
  };

  assert.match(calendarSource, /fetchSharedWeather\(\{ startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.match(calendarSource, /sharedWeatherDailyFromPayload\(sharedWeather, \{ location: weatherLocation, startDate: weatherStart, endDate: weatherEnd \}\)/);
  assert.match(calendarSource, /sharedWeatherDaypartsFromPayload\(sharedWeather, \{ location: weatherLocation, date \}\)/);

  const daily = sharedWeatherDailyFromPayload(sharedPayload, {
    location: "pohang",
    startDate: "2026-06-22",
    endDate: "2026-06-22",
  });
  assert.equal(daily.ok, true);
  assert.deepEqual(daily.items, [{ date: "2026-06-22", glyph: "🌧", condition: "rain", min_c: 21, max_c: 26 }]);

  const dayparts = sharedWeatherDaypartsFromPayload(sharedPayload, {
    location: "pohang",
    date: "2026-06-22",
  });
  assert.equal(dayparts.ok, true);
  assert.equal(dayparts.weather_dayparts_available, true);
  assert.deepEqual(dayparts.weather_dayparts, [
    { label: "Morning", temp_min_c: 21, temp_max_c: 23 },
    { label: "Afternoon", temp_min_c: 24, temp_max_c: 26 },
  ]);
});

test("shared weather helper slices backend cache payload for Family calendar weather", async () => {
  const sharedPayload = {
    ok: true,
    locations: [
      {
        id: "yeongdeok",
        label: "영덕",
        weather: {
          daily: [],
          dayparts: {},
        },
      },
      {
        id: "pohang",
        label: "포항",
        weather: {
          daily: [
            { date: "2026-06-21", glyph: "☁", condition: "cloudy", min_c: 17, max_c: 28 },
            { date: "2026-06-22", glyph: "🌧", condition: "rain", min_c: 21, max_c: 26 },
          ],
          dayparts: {
            "2026-06-22": [
              { label: "Morning", temp_min_c: 21, temp_max_c: 23 },
              { label: "Afternoon", temp_min_c: 24, temp_max_c: 26 },
            ],
          },
        },
      },
      {
        id: "daegu",
        label: "대구",
        weather: {
          daily: [],
          dayparts: {},
        },
      },
      {
        id: "yeongcheon",
        label: "영천",
        weather: {
          daily: [],
          dayparts: {},
        },
      },
    ],
  };
  const normalized = normalizeSharedWeatherPayload(sharedPayload);
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.locations.map((location) => location.id), ["yeongdeok", "pohang", "daegu", "yeongcheon"]);

  const originalFetch = globalThis.fetch;
  clearSharedWeatherRequestCache();
  globalThis.fetch = async (url) => {
    assert.equal(url, "/api/weather?start_date=2026-06-22&end_date=2026-06-22");
    return { json: async () => sharedPayload };
  };

  try {
    const daily = await fetchWeatherDaily({ location: "pohang", startDate: "2026-06-22", endDate: "2026-06-22" });
    assert.equal(daily.ok, true);
    assert.equal(daily.locations.length, 4);
    assert.deepEqual(daily.items, [{ date: "2026-06-22", glyph: "🌧", condition: "rain", min_c: 21, max_c: 26 }]);

    const dayparts = await fetchWeatherDayparts({ location: "pohang", date: "2026-06-22" });
    assert.equal(dayparts.ok, true);
    assert.equal(dayparts.weather_dayparts_available, true);
    assert.deepEqual(dayparts.weather_dayparts, [
      { label: "Morning", temp_min_c: 21, temp_max_c: 23 },
      { label: "Afternoon", temp_min_c: 24, temp_max_c: 26 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    clearSharedWeatherRequestCache();
  }
});

test("family calendar expanded week keeps weather compact by default and renders it before all-day rows", async () => {
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");
  const compactCss = await readSource("../app/styles/family-calendar-compact-month.css");

  assert.match(calendarSource, /const\s*\[weatherExpanded,\s*setWeatherExpanded\]\s*=\s*useState\(false\);/);
  assert.match(calendarSource, /setWeatherExpanded\(false\);[\s\S]*?\},\s*\[selectedWeekKey,\s*calendarMode,\s*monthDate\]\);/);
  assert.match(calendarSource, /expanded=\{weatherExpanded\}/);
  assert.match(calendarSource, /onToggle=\{\(\)\s*=>\s*setWeatherExpanded\(\(current\)\s*=>\s*!current\)\}/);
  assert.match(calendarSource, /onToggle=\{onToggleWeather\}/);

  assert.match(weatherRowsSource, /aria-expanded=\{expanded\}/);
  assert.match(weatherRowsSource, /aria-label="날씨 자세히 보기"/);
  assert.match(weatherRowsSource, /className="familyCalendarWeatherToggleLabel">•<\/span>/);
  assert.match(weatherRowsSource, /FAMILY_CALENDAR_DAYPART_RAIL_LABELS\s*=\s*\["M",\s*"A",\s*"E",\s*"N"\]/);
  assert.match(weatherRowsSource, /\{FAMILY_CALENDAR_DAYPART_RAIL_LABELS\[index\]\}/);
  assert.match(weatherRowsSource, /familyCalendarWeatherSummaryRow/);
  assert.match(weatherRowsSource, /function DailyWeatherSummary\(\{ label, range \}\)/);
  assert.match(weatherRowsSource, /familyCalendarWeatherSummaryGlyph/);
  assert.match(weatherRowsSource, /familyCalendarWeatherSummaryRange/);
  assert.match(weatherRowsSource, /familyCalendarSectionSeparated/);
  assert.match(weatherRowsSource, /\{expanded\s*\?\s*FAMILY_CALENDAR_DAYPART_LABELS\.map/);

  const weatherIndex = calendarSource.indexOf("<FamilyCalendarWeatherRows");
  const allDayIndex = calendarSource.indexOf('className="familyCalendarTimeRow familyCalendarAllDayRow"', weatherIndex);
  const timedIndex = calendarSource.indexOf("<FamilyCalendarTimedArea", allDayIndex);
  assert.ok(weatherIndex >= 0, "expanded selected week should render weather rows");
  assert.ok(allDayIndex > weatherIndex, "all-day row should render after weather rows");
  assert.ok(timedIndex > allDayIndex, "timed rows should render after all-day rows");

  assert.match(weatherCss, /\.familyCalendarWeatherSummaryRow/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummaryRow \+ \.familyCalendarWeatherRow\s*\{[\s\S]*?border-top:\s*0;/);
  assert.match(weatherCss, /\.familyCalendarWeatherToggle/);
  assert.match(weatherCss, /\.familyCalendarWeatherToggleLabel/);
  assert.doesNotMatch(weatherCss, /familyCalendarWeatherToggleGlyph/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummary/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummary\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*1px;/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummaryGlyph\s*\{[\s\S]*?font-size:\s*16px;/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummaryRange\s*\{[\s\S]*?font-size:\s*10px;/);
  assert.match(weatherCss, /\.familyCalendarWeatherDaypart/);
  assert.match(weatherCss, /\.familyCalendarWeatherLabelText/);
  assert.match(weatherCss, /\.familyCalendarWeatherToggle,\s*\n\.familyCalendarWeatherLabel\s*\{[\s\S]*?font-family:\s*"Sarasa Gothic Mono"[\s\S]*?font-size:\s*10px;[\s\S]*?font-variant-numeric:\s*tabular-nums;[\s\S]*?letter-spacing:\s*0;/);
  assert.match(compactCss, /grid-template-columns:\s*var\(--family-calendar-expanded-rail-width,\s*20px\)\s*repeat\(7,\s*minmax\(0,\s*1fr\)\);/);
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
  for (const label of ["M", "A", "E", "N"]) {
    assert.ok(weatherRowsSource.includes(`"${label}"`), `${label} should appear in compact Family weather rail labels`);
  }
});

test("family weather debug panel is removed from visible output", async () => {
  const debugPanelSource = await readSource("../app/family/calendar/FamilyCalendarWeatherDebugPanel.js");

  assert.ok(debugPanelSource.includes("return null;"));
  assert.doesNotMatch(debugPanelSource, /임시 날씨 디버그/);
  assert.doesNotMatch(debugPanelSource, /JSON\.stringify\(value, null, 2\)/);
});

test("family calendar daily weather regenerates display label from glyph condition and weather_code", async () => {
  const weatherClient = await readSource("../app/lib/weather-client.js");
  const calendarSource = await readSource("../app/family/calendar/FamilyCalendarClient.js");
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");

  assert.match(weatherClient, /const FAMILY_WEATHER_GLYPHS/);
  assert.match(weatherClient, /function resolveFamilyWeatherKind\(rawValue, fallbackLabel = "", weatherCode = ""\)/);
  assert.match(weatherClient, /const sources = \[value, fallbackLabel, weatherCode\];/);
  assert.match(weatherClient, /weatherLabel: item\?\.weatherLabel \|\| formatFamilyWeatherLabel\(item\?\.glyph, familyWeatherLabelSource\(item\), item\?\.weather_code\)/);
  assert.match(weatherRowsSource, /function dailyWeatherDisplay\(weather\)/);
  assert.match(weatherRowsSource, /formatFamilyWeatherLabel\(\s*weather\?\.glyph,\s*weather\?\.condition \|\| weather\?\.summary \|\| weather\?\.label,\s*weather\?\.weather_code,?\s*\)/);
  assert.match(calendarSource, /setWeatherItems\(normalizeFamilyWeatherDailyItems\(Array\.isArray\(data\.items\) \? data\.items : \[\]\)\)/);
});

test("family calendar daypart weather rows reuse daily weather glyph with daypart temperature range", async () => {
  const weatherRowsSource = await readSource("../app/family/calendar/FamilyCalendarWeatherRows.js");

  assert.match(weatherRowsSource, /const dailyWeather = weatherByDate\.get\(date\);/);
  assert.match(weatherRowsSource, /const weatherLabel = dailyWeatherDisplay\(dailyWeather\);/);
  assert.match(weatherRowsSource, /formatWeatherText\(weatherLabel, formatDaypartRange\(weather\)\)/);
  assert.doesNotMatch(weatherRowsSource, /daypartWeatherFallbackLabel/);
  assert.doesNotMatch(weatherRowsSource, /Morning|Afternoon|Evening|Night/);
});

test("family weather CSS centers weather label text within each cell", async () => {
  const weatherCss = await readSource("../app/styles/family-calendar-weather.css");

  assert.match(weatherCss, /\.familyCalendarWeatherSlot\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*center;[\s\S]*?text-align:\s*center;/);
  assert.match(weatherCss, /\.familyCalendarWeatherSummary,[\s\S]*?\.familyCalendarWeatherDaypart\s*\{[\s\S]*?justify-content:\s*center;[\s\S]*?gap:\s*4px;[\s\S]*?text-align:\s*center;/);
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

test("existing Family all-day event source coverage remains intact", async () => {
  const editTestSource = await readSource("./family-calendar-edit.test.js");

  assert.ok(
    editTestSource.includes("family calendar all-day marker defaults the form and renders a top all-day row"),
    "existing all-day event test should remain present",
  );
});
