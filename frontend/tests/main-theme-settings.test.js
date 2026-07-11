import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("main Settings exposes a selectable Catppuccin/Nord theme", async () => {
  const settingsPage = await readSource("../app/settings/page.js");
  const themeSettings = await readSource("../components/settings/MainThemeSettings.js");
  const themeHelper = await readSource("../lib/main-theme.js");

  assert.match(settingsPage, /MainThemeSettings/);
  assert.match(settingsPage, />Theme<\/span>/);
  assert.match(themeSettings, /aria-label="Main color theme"/);
  assert.match(themeSettings, /setStoredMainTheme\(event\.target\.value\)/);
  assert.match(themeHelper, /MAIN_THEME_STORAGE_KEY = "kaosgdd\.mainTheme\.v1"/);
  assert.match(themeHelper, /MAIN_THEME_OPTIONS = \[/);
  assert.match(themeHelper, /value: "catppuccin", label: "Catppuccin"/);
  assert.match(themeHelper, /value: "nord", label: "Nord"/);
});

test("Nord theme remaps existing main tokens without renaming component colors", async () => {
  const tokensCss = await readSource("../app/styles/tokens.css");

  assert.match(tokensCss, /html\[data-kaos-theme="nord"\]\s*\{/);
  assert.match(tokensCss, /--ctp-blue:\s*#5e81ac;/);
  assert.match(tokensCss, /--ctp-sky:\s*#88c0d0;/);
  assert.match(tokensCss, /--ctp-green:\s*#a3be8c;/);
  assert.match(tokensCss, /--ctp-yellow:\s*#ebcb8b;/);
  assert.match(tokensCss, /--ctp-red:\s*#bf616a;/);
  assert.match(tokensCss, /--ctp-crust:\s*#1f242e;/);
  assert.match(tokensCss, /--ui-accent-soft:\s*rgba\(94, 129, 172, 0\.14\);/);
});

test("main theme application is disabled on Family surfaces", async () => {
  const shellFrame = await readSource("../components/AppShellFrame.js");
  const themeHelper = await readSource("../lib/main-theme.js");

  assert.match(shellFrame, /applyMainTheme\(getStoredMainTheme\(\), !familySurface\)/);
  assert.match(shellFrame, /listenMainThemeChange\(\(theme\) => applyMainTheme\(theme, !familySurface\)\)/);
  assert.match(themeHelper, /delete document\.documentElement\.dataset\.kaosTheme;/);
  assert.match(themeHelper, /document\.documentElement\.dataset\.kaosTheme = normalized;/);
});
