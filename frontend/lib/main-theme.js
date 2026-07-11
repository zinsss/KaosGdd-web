export const MAIN_THEME_STORAGE_KEY = "kaosgdd.mainTheme.v1";
export const MAIN_THEME_CHANGED_EVENT = "kaosgdd:main-theme-changed";
export const DEFAULT_MAIN_THEME = "catppuccin";

export const MAIN_THEME_OPTIONS = [
  { value: "catppuccin", label: "Catppuccin" },
  { value: "nord", label: "Nord" },
];

export function normalizeMainTheme(value) {
  const raw = String(value || "").trim().toLowerCase();
  return MAIN_THEME_OPTIONS.some((option) => option.value === raw) ? raw : DEFAULT_MAIN_THEME;
}

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getStoredMainTheme() {
  return normalizeMainTheme(getStorage()?.getItem(MAIN_THEME_STORAGE_KEY));
}

export function applyMainTheme(theme, enabled = true) {
  if (typeof document === "undefined") return;
  const normalized = normalizeMainTheme(theme);
  if (!enabled || normalized === DEFAULT_MAIN_THEME) {
    delete document.documentElement.dataset.kaosTheme;
    return;
  }
  document.documentElement.dataset.kaosTheme = normalized;
}

export function setStoredMainTheme(theme) {
  const normalized = normalizeMainTheme(theme);
  const storage = getStorage();
  if (storage) {
    storage.setItem(MAIN_THEME_STORAGE_KEY, normalized);
  }
  applyMainTheme(normalized, true);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MAIN_THEME_CHANGED_EVENT, { detail: { theme: normalized } }));
  }
  return normalized;
}

export function listenMainThemeChange(callback) {
  if (typeof window === "undefined") return () => {};

  function notify(theme) {
    callback(normalizeMainTheme(theme));
  }

  function onThemeChanged(event) {
    notify(event?.detail?.theme || getStoredMainTheme());
  }

  function onStorage(event) {
    if (event.key === MAIN_THEME_STORAGE_KEY) notify(event.newValue);
  }

  window.addEventListener(MAIN_THEME_CHANGED_EVENT, onThemeChanged);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MAIN_THEME_CHANGED_EVENT, onThemeChanged);
    window.removeEventListener("storage", onStorage);
  };
}
