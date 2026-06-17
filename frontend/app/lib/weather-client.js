export const DEFAULT_WEATHER_LOCATION = "pohang";
export const DEFAULT_WEATHER_LOCATIONS = [
  { id: "yeongdeok", label: "영덕" },
  { id: DEFAULT_WEATHER_LOCATION, label: "포항" },
  { id: "daegu", label: "대구" },
];
export const WEATHER_LOCATION_STORAGE_KEY = "kaosgdd.weather.location.v1";
export const FAMILY_CALENDAR_DAYPART_LABELS = ["오전", "오후", "저녁", "밤"];

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
    if (!item) return { label, glyph: "", temp_min_c: "", temp_max_c: "" };
    return {
      label: String(item.label || label),
      glyph: String(item.glyph || ""),
      temp_min_c: item.temp_min_c ?? "",
      temp_max_c: item.temp_max_c ?? "",
    };
  });
}
