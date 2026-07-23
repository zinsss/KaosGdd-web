import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ANALOGUE_INITIAL_STATE,
  changeAnalogueLevel,
  reduceAnalogueShortcut,
  resetAnalogueDashboard,
  setAnalogueLevel,
  toggleAnalogueIndicator,
  toggleAnalogueWarning,
} from "../app/family/analogue-dashboard/analogueDashboardState.js";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family analogue dashboard route tile shell and styles are wired", async () => {
  const pageSource = await readSource("../app/family/analogue-dashboard/page.js");
  const clientSource = await readSource("../app/family/analogue-dashboard/AnalogueDashboardClient.js");
  const homeSource = await readSource("../app/family/FamilyDashboardClient.js");
  const launcherSource = await readSource("../app/family/dashboards/page.js");
  const appShellSource = await readSource("../components/AppShell.js");
  const proxySource = await readSource("../proxy.js");
  const globalsCss = await readSource("../app/globals.css");
  const cssSource = await readSource("../app/styles/family-analogue-dashboard.css");

  assert.ok(pageSource.includes("아날로그 계기판 놀이 - KaosGdd"));
  assert.ok(launcherSource.includes('href="/family/analogue-dashboard"'));
  assert.ok(launcherSource.includes("아날로그 계기판"));
  assert.ok(launcherSource.includes("바늘을 밀어서 속도와 연료를 바꿔 보세요"));
  assert.ok(!homeSource.includes('href="/family/analogue-dashboard"'));
  assert.ok(appShellSource.includes('"/family"'));
  assert.ok(proxySource.includes('"/analogue-dashboard"'));
  assert.ok(globalsCss.includes("family-analogue-dashboard.css"));
  assert.ok(clientSource.includes("onPointerDown"));
  assert.ok(clientSource.includes("onPointerMove"));
  assert.ok(clientSource.includes("DashboardSymbol"));
  assert.ok(clientSource.includes("analogueSymbolStrip"));
  assert.ok(clientSource.includes("타이어 압력"));
  assert.ok(clientSource.includes("엔진 경고"));
  assert.ok(clientSource.includes("연료 부족"));
  assert.ok(clientSource.includes("온도 경고"));
  assert.ok(clientSource.includes("배터리"));
  assert.ok(clientSource.includes("오일"));
  assert.ok(clientSource.includes("주차 브레이크"));
  assert.ok(clientSource.includes('type="left"'));
  assert.ok(clientSource.includes('type="right"'));
  assert.ok(clientSource.includes('type="engine"'));
  assert.ok(clientSource.includes('type="tyre"'));
  assert.ok(clientSource.includes("SymbolToggle"));
  assert.ok(!clientSource.includes("href="));
  assert.ok(cssSource.includes("body:has(.analogueDashboardPage) .appShellTop"));
  assert.ok(cssSource.includes("min-height: calc(100dvh - var(--app-shell-safe-top));"));
  assert.ok(cssSource.includes("height: calc(100dvh - var(--app-shell-safe-top));"));
  assert.ok(cssSource.includes("padding-top: var(--app-shell-safe-top) !important;"));
  assert.ok(cssSource.includes(".analogueSymbolStrip"));
  assert.ok(cssSource.includes(".analogueSymbol"));
  assert.ok(cssSource.includes("@media (prefers-reduced-motion: reduce)"));
});

test("family analogue dashboard levels clamp and snap", () => {
  let state = { ...ANALOGUE_INITIAL_STATE };

  state = setAnalogueLevel(state, "speed", 223);
  assert.equal(state.speed, 220);
  state = setAnalogueLevel(state, "speed", 13);
  assert.equal(state.speed, 15);
  state = setAnalogueLevel(state, "rpm", 8120);
  assert.equal(state.rpm, 8000);
  state = setAnalogueLevel(state, "rpm", 1260);
  assert.equal(state.rpm, 1300);
  state = setAnalogueLevel(state, "fuel", -4);
  assert.equal(state.fuel, 0);
  state = setAnalogueLevel(state, "temp", 103);
  assert.equal(state.temp, 100);
});

test("family analogue dashboard toggles indicators and warnings", () => {
  let state = { ...ANALOGUE_INITIAL_STATE };

  state = toggleAnalogueIndicator(state, "left");
  assert.equal(state.leftIndicator, true);
  assert.equal(state.rightIndicator, false);
  state = toggleAnalogueIndicator(state, "right");
  assert.equal(state.leftIndicator, false);
  assert.equal(state.rightIndicator, true);
  state = toggleAnalogueWarning(state, "tyrePressure");
  assert.equal(state.tyrePressure, true);
  state = toggleAnalogueWarning(state, "engineWarning");
  assert.equal(state.engineWarning, true);
});

test("family analogue dashboard shortcuts and reset work", () => {
  let state = { ...ANALOGUE_INITIAL_STATE };

  state = reduceAnalogueShortcut(state, { key: "ArrowUp" });
  assert.equal(state.speed, 5);
  state = reduceAnalogueShortcut(state, { key: "R" });
  assert.equal(state.rpm, 500);
  state = reduceAnalogueShortcut(state, { key: "F" });
  assert.equal(state.fuel, 65);
  state = reduceAnalogueShortcut(state, { key: "T" });
  assert.equal(state.temp, 50);
  state = reduceAnalogueShortcut(state, { key: "P" });
  assert.equal(state.tyrePressure, true);
  state = reduceAnalogueShortcut(state, { key: "E" });
  assert.equal(state.engineWarning, true);
  state = reduceAnalogueShortcut(state, { key: "Escape" });
  assert.deepEqual(state, resetAnalogueDashboard());
});

test("family analogue dashboard incremental controls stay bounded", () => {
  let state = { ...ANALOGUE_INITIAL_STATE, speed: 220, rpm: 8000 };

  state = changeAnalogueLevel(state, "speed", 20);
  assert.equal(state.speed, 220);
  state = changeAnalogueLevel(state, "rpm", 1000);
  assert.equal(state.rpm, 8000);
  state = changeAnalogueLevel({ ...state, fuel: 0 }, "fuel", -10);
  assert.equal(state.fuel, 0);
});
