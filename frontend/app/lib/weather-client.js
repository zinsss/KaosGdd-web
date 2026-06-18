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
  return item?.label || item?.condition || item?.summary || fallbackLabel;
}

function familyWeatherDaypartSource(item) {
  const label = String(item?.label || "").trim();
  if (label && !FAMILY_CALENDAR_DAYPART_LABELS.includes(label)) {
    return label;
  }
  return item?.condition || item?.summary || "";
}

function isRenderableKoreanWeatherLabel(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (FAMILY_CALENDAR_DAYPART_LABELS.includes(text)) return false;
  return /[가-힣]/.test(text);
}

export function formatFamilyWeatherLabel(rawValue, fallbackLabel = "") {
  const value = String(rawValue || "").trim();
  if (FAMILY_WEATHER_LABEL_VARIANTS.has(value)) {
    return FAMILY_WEATHER_LABEL_VARIANTS.get(value);
  }

  const token = normalizeWeatherToken(value || fallbackLabel);
  if (!token) return isRenderableKoreanWeatherLabel(fallbackLabel) ? String(fallbackLabel).trim() : "";

  if (["clear", "sun", "sunny", "s"].includes(token)) return FAMILY_WEATHER_LABELS.clear;
  if (["partly", "partly-cloudy", "partlycloudy", "mostly-sunny", "mostlysunny"].includes(token)) return FAMILY_WEATHER_LABELS.partly;
  if (["cloud", "clouds", "cloudy", "c", "overcast"].includes(token)) return FAMILY_WEATHER_LABELS.cloudy;
  if (["rain", "rainy", "r", "shower", "showers", "drizzle"].includes(token)) return FAMILY_WEATHER_LABELS.rain;
  if (["storm", "thunder", "thunderstorm", "lightning"].includes(token)) return FAMILY_WEATHER_LABELS.storm;
  if (["snow", "snowy", "sleet", "blizzard"].includes(token)) return FAMILY_WEATHER_LABELS.snow;
  if (["night", "moon", "clear-night", "clearnight", "n"].includes(token)) return FAMILY_WEATHER_LABELS.night;
  if (["wind", "windy", "gust", "gusty", "breeze", "breezy"].includes(token)) return FAMILY_WEATHER_LABELS.wind;

  if (/night|moon/.test(token)) return FAMILY_WEATHER_LABELS.night;
  if (/snow|sleet/.test(token)) return FAMILY_WEATHER_LABELS.snow;
  if (/storm|thunder/.test(token)) return FAMILY_WEATHER_LABELS.storm;
  if (/rain|drizzle|shower/.test(token)) return FAMILY_WEATHER_LABELS.rain;
  if (/wind|gust|breeze/.test(token)) return FAMILY_WEATHER_LABELS.wind;
  if (/partly|sun.*cloud|cloud.*sun/.test(token)) return FAMILY_WEATHER_LABELS.partly;
  if (/cloud|overcast/.test(token)) return FAMILY_WEATHER_LABELS.cloudy;
  if (/clear|sun/.test(token)) return FAMILY_WEATHER_LABELS.clear;

  if (isRenderableKoreanWeatherLabel(value)) return value;
  if (isRenderableKoreanWeatherLabel(fallbackLabel)) return String(fallbackLabel).trim();
  return "";
}

export function normalizeFamilyWeatherDailyItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    weatherLabel: formatFamilyWeatherLabel(item?.glyph, familyWeatherLabelSource(item)),
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
  const res = await fetch(
    `/api/weather/daily?location=${encodeURIComponent(location)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
  );
  return res.json();
}

export async function fetchWeatherDayparts({ location, date }) {
  const res = await fetch(
    `/api/weather/dayparts?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`,
  );
  return res.json();
}

export function normalizeFamilyWeatherDayparts(payload) {
  const items = Array.isArray(payload?.weather_dayparts) ? payload.weather_dayparts : [];
  return FAMILY_CALENDAR_DAYPART_LABELS.map((label, index) => {
    const item = items[index];
    if (!item) return { label, weatherLabel: "", temp_min_c: "", temp_max_c: "" };
    return {
      label: String(item.label || label),
      weatherLabel: formatFamilyWeatherLabel(item.glyph, familyWeatherDaypartSource(item)),
      temp_min_c: item.temp_min_c ?? "",
      temp_max_c: item.temp_max_c ?? "",
    };
  });
}
