export const DEFAULT_WEATHER_LOCATION = "pohang";
export const DEFAULT_WEATHER_LOCATIONS = [
  { id: "yeongdeok", label: "영덕" },
  { id: DEFAULT_WEATHER_LOCATION, label: "포항" },
  { id: "daegu", label: "대구" },
];
export const WEATHER_LOCATION_STORAGE_KEY = "kaosgdd.weather.location.v1";
export const FAMILY_CALENDAR_DAYPART_LABELS = ["오전", "오후", "저녁", "밤"];

const FAMILY_WEATHER_LABELS = {
  clear: "맑음",
  partly: "구름",
  cloudy: "흐림",
  rain: "비",
  storm: "폭우",
  snow: "눈",
  night: "밤",
  wind: "바람",
};

const FAMILY_WEATHER_GLYPHS = {
  clear: "☀",
  partly: "⛅",
  cloudy: "☁",
  rain: "🌧",
  storm: "⛈",
  snow: "❄",
  night: "🌙",
};

const FAMILY_WEATHER_LABEL_VARIANTS = new Map([
  ["☀", FAMILY_WEATHER_LABELS.clear],
  ["☀️", FAMILY_WEATHER_LABELS.clear],
  ["⛅", FAMILY_WEATHER_LABELS.partly],
  ["🌤", FAMILY_WEATHER_LABELS.partly],
  ["🌤️", FAMILY_WEATHER_LABELS.partly],
  ["☁", FAMILY_WEATHER_LABELS.cloudy],
  ["☁️", FAMILY_WEATHER_LABELS.cloudy],
  ["☂", FAMILY_WEATHER_LABELS.rain],
  ["🌧", FAMILY_WEATHER_LABELS.rain],
  ["🌧️", FAMILY_WEATHER_LABELS.rain],
  ["☇", FAMILY_WEATHER_LABELS.storm],
  ["⛈", FAMILY_WEATHER_LABELS.storm],
  ["⛈️", FAMILY_WEATHER_LABELS.storm],
  ["❄", FAMILY_WEATHER_LABELS.snow],
  ["❄️", FAMILY_WEATHER_LABELS.snow],
  ["☾", FAMILY_WEATHER_LABELS.night],
  ["🌙", FAMILY_WEATHER_LABELS.night],
]);

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeWeatherToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[._]/g, "")
    .replace(/[\ufe0e\ufe0f]/g, "")
    .replace(/\s+/g, "-");
}

function familyWeatherLabelSource(item, fallbackLabel = "") {
  return item?.condition || item?.label || item?.summary || fallbackLabel;
}

function isRenderableKoreanWeatherLabel(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (FAMILY_CALENDAR_DAYPART_LABELS.includes(text)) return false;
  return /[가-힣]/.test(text);
}

function familyWeatherKindFromToken(token) {
  if (!token) return "";

  const numericCode = Number(token);
  if (Number.isInteger(numericCode)) {
    if (numericCode === 0) return "clear";
    if ([1, 2].includes(numericCode)) return "partly";
    if ([3, 45, 48].includes(numericCode)) return "cloudy";
    if ((numericCode >= 51 && numericCode <= 67) || (numericCode >= 80 && numericCode <= 82)) return "rain";
    if ((numericCode >= 71 && numericCode <= 77) || (numericCode >= 85 && numericCode <= 86)) return "snow";
    if (numericCode >= 95 && numericCode <= 99) return "storm";
  }

  if (["clear", "sun", "sunny", "s"].includes(token)) return "clear";
  if (["partly", "partly-cloudy", "partlycloudy", "mostly-sunny", "mostlysunny", "partlycloudyday"].includes(token)) return "partly";
  if (["cloud", "clouds", "cloudy", "c", "overcast"].includes(token)) return "cloudy";
  if (["rain", "rainy", "r", "shower", "showers", "drizzle"].includes(token)) return "rain";
  if (["storm", "thunder", "thunderstorm", "lightning"].includes(token)) return "storm";
  if (["snow", "snowy", "sleet", "blizzard"].includes(token)) return "snow";
  if (["night", "moon", "clear-night", "clearnight", "n"].includes(token)) return "night";
  if (["wind", "windy", "gust", "gusty", "breeze", "breezy"].includes(token)) return "wind";

  if (/night|moon/.test(token)) return "night";
  if (/snow|sleet/.test(token)) return "snow";
  if (/storm|thunder/.test(token)) return "storm";
  if (/rain|drizzle|shower/.test(token)) return "rain";
  if (/wind|gust|breeze/.test(token)) return "wind";
  if (/partly|sun.*cloud|cloud.*sun/.test(token)) return "partly";
  if (/cloud|overcast/.test(token)) return "cloudy";
  if (/clear|sun/.test(token)) return "clear";

  return "";
}

function resolveFamilyWeatherKind(rawValue, fallbackLabel = "", weatherCode = "") {
  const value = String(rawValue || "").trim();
  if (FAMILY_WEATHER_LABEL_VARIANTS.has(value)) {
    const variantLabel = FAMILY_WEATHER_LABEL_VARIANTS.get(value);
    return Object.entries(FAMILY_WEATHER_LABELS).find(([, label]) => label === variantLabel)?.[0] || "";
  }

  const sources = [value, fallbackLabel, weatherCode];
  for (const source of sources) {
    const kind = familyWeatherKindFromToken(normalizeWeatherToken(source));
    if (kind) return kind;
  }

  if (isRenderableKoreanWeatherLabel(value)) return value;
  if (isRenderableKoreanWeatherLabel(fallbackLabel)) return String(fallbackLabel).trim();
  return "";
}

export function formatFamilyWeatherLabel(rawValue, fallbackLabel = "", weatherCode = "") {
  const kind = resolveFamilyWeatherKind(rawValue, fallbackLabel, weatherCode);
  if (!kind) return "";
  if (FAMILY_WEATHER_GLYPHS[kind]) return FAMILY_WEATHER_GLYPHS[kind];
  if (FAMILY_WEATHER_LABELS[kind]) return FAMILY_WEATHER_LABELS[kind];
  return kind;
}

export function normalizeFamilyWeatherDailyItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    weatherLabel: item?.weatherLabel || formatFamilyWeatherLabel(item?.glyph, familyWeatherLabelSource(item), item?.weather_code),
  }));
}

export function normalizeWeatherLocation(location) {
  const wanted = String(location || "").trim().toLowerCase();
  return DEFAULT_WEATHER_LOCATIONS.some((option) => option.id === wanted)
    ? wanted
    : DEFAULT_WEATHER_LOCATION;
}

export function normalizeWeatherLocations(locations) {
  if (!Array.isArray(locations) || !locations.length) return DEFAULT_WEATHER_LOCATIONS;
  const nextLocations = locations
    .map((location) => ({
      id: String(location?.id || "").trim(),
      label: String(location?.label || "").trim(),
    }))
    .filter((location) => location.id && location.label);
  return nextLocations.length ? nextLocations : DEFAULT_WEATHER_LOCATIONS;
}

export function getStoredWeatherLocation() {
  const storage = browserStorage();
  if (!storage) return DEFAULT_WEATHER_LOCATION;
  return normalizeWeatherLocation(storage.getItem(WEATHER_LOCATION_STORAGE_KEY));
}

export function setStoredWeatherLocation(location) {
  const nextLocation = normalizeWeatherLocation(location);
  const storage = browserStorage();
  if (storage) storage.setItem(WEATHER_LOCATION_STORAGE_KEY, nextLocation);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kaosgdd:weather-location-changed", {
      detail: { location: nextLocation },
    }));
  }
  return nextLocation;
}

export function listenWeatherLocationChange(onChange) {
  if (typeof window === "undefined") return () => {};

  function handleStorage(event) {
    if (event.key === WEATHER_LOCATION_STORAGE_KEY) {
      onChange(normalizeWeatherLocation(event.newValue));
    }
  }

  function handleCustom(event) {
    onChange(normalizeWeatherLocation(event?.detail?.location));
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener("kaosgdd:weather-location-changed", handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("kaosgdd:weather-location-changed", handleCustom);
  };
}

export async function fetchWeatherDaily({ location, startDate, endDate }) {
  const data = await fetchSharedWeather();
  return sharedWeatherDailyFromPayload(data, { location, startDate, endDate });
}

export function sharedWeatherDailyFromPayload(data, { location, startDate, endDate }) {
  const normalizedLocation = normalizeWeatherLocation(location);
  const locationWeather = findSharedWeatherLocation(data, normalizedLocation);
  if (!locationWeather) {
    return {
      ok: false,
      error: "weather unavailable",
      location: { id: normalizedLocation, label: normalizedLocation },
      locations: normalizeWeatherLocations(data?.locations),
      items: [],
    };
  }

  const items = Array.isArray(locationWeather.weather?.daily)
    ? locationWeather.weather.daily.filter((item) => {
      const date = String(item?.date || "");
      return date >= startDate && date <= endDate;
    })
    : [];
  return {
    ok: true,
    location: { id: locationWeather.id, label: locationWeather.label },
    locations: normalizeWeatherLocations(data?.locations),
    stale: Boolean(locationWeather.stale),
    items,
  };
}

export async function fetchWeatherDayparts({ location, date }) {
  const data = await fetchSharedWeather();
  return sharedWeatherDaypartsFromPayload(data, { location, date });
}

export function sharedWeatherDaypartsFromPayload(data, { location, date }) {
  const normalizedLocation = normalizeWeatherLocation(location);
  const locationWeather = findSharedWeatherLocation(data, normalizedLocation);
  const weatherDayparts = locationWeather?.weather?.dayparts?.[date] || [];
  return {
    ok: Boolean(locationWeather),
    date,
    location: locationWeather ? { id: locationWeather.id, label: locationWeather.label } : { id: normalizedLocation, label: normalizedLocation },
    locations: normalizeWeatherLocations(data?.locations),
    stale: Boolean(locationWeather?.stale),
    weather_dayparts_available: Array.isArray(weatherDayparts) && weatherDayparts.length > 0,
    weather_unavailable_reason: Array.isArray(weatherDayparts) && weatherDayparts.length > 0 ? "" : "Weather info not available by time of day.",
    weather_dayparts: Array.isArray(weatherDayparts) ? weatherDayparts : [],
  };
}

export async function fetchSharedWeather() {
  const res = await fetch("/api/weather");
  return normalizeSharedWeatherPayload(await res.json());
}

export function normalizeSharedWeatherPayload(data) {
  const locations = Array.isArray(data) ? data : data?.locations;
  return {
    ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
    ok: data?.ok !== false,
    locations: normalizeSharedWeatherLocationEntries(locations),
  };
}

function normalizeSharedWeatherLocationEntries(locations) {
  if (!Array.isArray(locations)) return [];
  return locations
    .map((location) => {
      const id = String(location?.id || "").trim();
      const label = String(location?.label || id).trim();
      if (!id) return null;
      const weather = location?.weather && typeof location.weather === "object" ? location.weather : {};
      return {
        ...location,
        id,
        label,
        weather: {
          ...weather,
          daily: Array.isArray(weather.daily) ? weather.daily : [],
          dayparts: weather.dayparts && typeof weather.dayparts === "object" ? weather.dayparts : {},
        },
      };
    })
    .filter(Boolean);
}

function findSharedWeatherLocation(data, location) {
  const locations = normalizeSharedWeatherPayload(data).locations;
  return locations.find((item) => item?.id === location) || null;
}

export function normalizeFamilyWeatherDayparts(payload) {
  const items = Array.isArray(payload?.weather_dayparts) ? payload.weather_dayparts : [];
  return FAMILY_CALENDAR_DAYPART_LABELS.map((label, index) => {
    const item = items[index];
    if (!item) return { label, weatherLabel: "", temp_min_c: "", temp_max_c: "" };
    return {
      label: String(item.label || label),
      weatherLabel: "",
      temp_min_c: item.temp_min_c ?? "",
      temp_max_c: item.temp_max_c ?? "",
    };
  });
}
