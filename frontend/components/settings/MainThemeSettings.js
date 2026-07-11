"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_MAIN_THEME,
  MAIN_THEME_OPTIONS,
  getStoredMainTheme,
  listenMainThemeChange,
  setStoredMainTheme,
} from "../../lib/main-theme";

export default function MainThemeSettings() {
  const [theme, setTheme] = useState(DEFAULT_MAIN_THEME);

  useEffect(() => {
    setTheme(getStoredMainTheme());
    return listenMainThemeChange(setTheme);
  }, []);

  return (
    <select
      aria-label="Main color theme"
      value={theme}
      onChange={(event) => setStoredMainTheme(event.target.value)}
    >
      {MAIN_THEME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
