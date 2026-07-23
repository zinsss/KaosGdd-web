import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  IONIQ_INITIAL_STATE,
  batteryRangeKm,
  batteryStatus,
  changeIoniqBattery,
  changeIoniqSpeed,
  cycleIoniqGear,
  reduceIoniqShortcut,
  resetIoniqDashboard,
  selectIoniqGear,
  toggleIoniqHazard,
  toggleIoniqSignal,
} from "../app/family/ioniq-dashboard/ioniqDashboardState.js";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family IONIQ dashboard route and launcher tile are wired", async () => {
  const pageSource = await readSource("../app/family/ioniq-dashboard/page.js");
  const clientSource = await readSource("../app/family/ioniq-dashboard/IoniqDashboardClient.js");
  const homeSource = await readSource("../app/family/FamilyDashboardClient.js");
  const launcherSource = await readSource("../app/family/dashboards/page.js");
  const appShellSource = await readSource("../components/AppShell.js");
  const globalsCss = await readSource("../app/globals.css");
  const cssSource = await readSource("../app/styles/family-ioniq-dashboard.css");

  assert.ok(pageSource.includes("아이오닉 5 계기판 놀이 - KaosGdd"));
  assert.ok(pageSource.includes("IoniqDashboardClient"));
  assert.ok(launcherSource.includes('href="/family/ioniq-dashboard"'));
  assert.ok(launcherSource.includes("아이오닉 계기판"));
  assert.ok(launcherSource.includes("버튼을 눌러 계기판을 움직여 보세요"));
  assert.ok(!homeSource.includes('href="/family/ioniq-dashboard"'));
  assert.ok(globalsCss.includes("family-ioniq-dashboard.css"));
  assert.ok(!clientSource.includes('import Link from "next/link"'));
  assert.ok(!clientSource.includes("← 가족 홈"));
  assert.ok(!clientSource.includes("ioniqDashboardTopbar"));
  assert.ok(!clientSource.includes("href="));
  assert.ok(appShellSource.includes('"/family"'));
  assert.ok(appShellSource.includes("appShellMainBare"));
  assert.ok(appShellSource.includes("shouldUseBareShell(pathname)"));
  assert.ok(clientSource.includes("전체 화면"));
  assert.ok(clientSource.includes("document.fullscreenElement"));
  assert.ok(clientSource.includes("requestFullscreen"));
  assert.ok(clientSource.includes("fullscreenSupported"));
  assert.ok(clientSource.includes("전체 화면 불가"));
  assert.ok(clientSource.includes("window.AudioContext || window.webkitAudioContext"));
  assert.ok(clientSource.includes("소리 켜짐"));
  assert.ok(clientSource.includes("소리 꺼짐"));
  assert.ok(clientSource.includes("자동 놀이"));
  assert.ok(clientSource.includes("빵빵"));
  assert.ok(cssSource.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(cssSource.includes("animation: none !important"));
  assert.ok(cssSource.includes("body:has(.ioniqDashboardPage) .appShellTop"));
  assert.ok(cssSource.includes("body:has(.ioniqDashboardPage) .appShellAttentionSlot"));
  assert.ok(cssSource.includes("body:has(.ioniqDashboardPage) .appShellMain"));
  assert.ok(cssSource.includes("min-height: calc(100dvh - var(--app-shell-safe-top));"));
  assert.ok(cssSource.includes("padding-top: var(--app-shell-safe-top) !important;"));
});

test("family IONIQ gear cycles and non-drive gears reset speed", () => {
  let state = { ...IONIQ_INITIAL_STATE };

  state = cycleIoniqGear(state);
  assert.equal(state.gear, "R");
  state = cycleIoniqGear(state);
  assert.equal(state.gear, "N");
  state = cycleIoniqGear(state);
  assert.equal(state.gear, "D");
  state = cycleIoniqGear(state);
  assert.equal(state.gear, "P");

  state = selectIoniqGear({ ...state, gear: "D", speed: 40 }, "P");
  assert.equal(state.speed, 0);
  state = selectIoniqGear({ ...state, gear: "D", speed: 40 }, "R");
  assert.equal(state.speed, 0);
  state = selectIoniqGear({ ...state, gear: "D", speed: 40 }, "N");
  assert.equal(state.speed, 0);
});

test("family IONIQ speed changes only in D and stays in range", () => {
  let state = { ...IONIQ_INITIAL_STATE, gear: "P", speed: 0 };

  state = changeIoniqSpeed(state, 10);
  assert.equal(state.speed, 0);

  state = selectIoniqGear(state, "D");
  state = changeIoniqSpeed(state, 10);
  assert.equal(state.speed, 10);
  state = changeIoniqSpeed({ ...state, speed: 120 }, 10);
  assert.equal(state.speed, 120);
  state = changeIoniqSpeed({ ...state, speed: 0 }, -10);
  assert.equal(state.speed, 0);
});

test("family IONIQ battery clamps and updates range/status", () => {
  let state = { ...IONIQ_INITIAL_STATE, battery: 100 };

  state = changeIoniqBattery(state, 10);
  assert.equal(state.battery, 100);
  state = changeIoniqBattery(state, -90);
  assert.equal(state.battery, 10);
  assert.equal(batteryRangeKm(state.battery), 50);
  assert.deepEqual(batteryStatus(state.battery), { tone: "red", message: "배터리가 부족해요" });
  state = changeIoniqBattery(state, -10);
  assert.equal(state.battery, 0);
  assert.deepEqual(batteryStatus(state.battery), { tone: "red", message: "충전이 필요해요" });
  state = changeIoniqBattery(state, 40);
  assert.deepEqual(batteryStatus(state.battery), { tone: "yellow", message: "" });
  state = changeIoniqBattery(state, 20);
  assert.deepEqual(batteryStatus(state.battery), { tone: "blue", message: "" });
});

test("family IONIQ signals are mutually exclusive and hazard overrides both", () => {
  let state = { ...IONIQ_INITIAL_STATE };

  state = toggleIoniqSignal(state, "left");
  assert.equal(state.leftSignal, true);
  assert.equal(state.rightSignal, false);
  state = toggleIoniqSignal(state, "right");
  assert.equal(state.leftSignal, false);
  assert.equal(state.rightSignal, true);
  state = toggleIoniqHazard(state);
  assert.equal(state.hazard, true);
  assert.equal(state.leftSignal, false);
  assert.equal(state.rightSignal, false);
  state = toggleIoniqSignal(state, "left");
  assert.equal(state.hazard, false);
  assert.equal(state.leftSignal, true);
  assert.equal(state.rightSignal, false);
});

test("family IONIQ reset restores initial driving state but keeps sound preference", () => {
  const state = resetIoniqDashboard({
    ...IONIQ_INITIAL_STATE,
    gear: "D",
    speed: 60,
    battery: 20,
    leftSignal: true,
    hazard: true,
    headlights: true,
    soundEnabled: false,
    autoPlay: true,
  });

  assert.equal(state.gear, "P");
  assert.equal(state.speed, 0);
  assert.equal(state.battery, 100);
  assert.equal(state.leftSignal, false);
  assert.equal(state.rightSignal, false);
  assert.equal(state.hazard, false);
  assert.equal(state.headlights, false);
  assert.equal(state.soundEnabled, false);
  assert.equal(state.autoPlay, false);
});

test("family IONIQ keyboard shortcuts trigger expected actions", () => {
  let state = { ...IONIQ_INITIAL_STATE };

  state = reduceIoniqShortcut(state, { key: "D" });
  state = reduceIoniqShortcut(state, { key: "ArrowUp" });
  assert.equal(state.gear, "D");
  assert.equal(state.speed, 10);

  state = reduceIoniqShortcut(state, { key: "ArrowLeft" });
  assert.equal(state.leftSignal, true);
  state = reduceIoniqShortcut(state, { key: "ArrowRight" });
  assert.equal(state.leftSignal, false);
  assert.equal(state.rightSignal, true);
  state = reduceIoniqShortcut(state, { key: " " });
  assert.equal(state.hazard, true);

  state = reduceIoniqShortcut(state, { key: "B" });
  assert.equal(state.battery, 90);
  state = reduceIoniqShortcut(state, { key: "B", shiftKey: true });
  assert.equal(state.battery, 100);
  state = reduceIoniqShortcut(state, { key: "H" });
  assert.equal(state.headlights, true);
  state = reduceIoniqShortcut(state, { key: "0" });
  assert.equal(state.speed, 0);
  state = reduceIoniqShortcut(state, { key: "Escape" });
  assert.equal(state.gear, "P");
  assert.equal(state.headlights, false);
});

test("family IONIQ audio and fullscreen guards avoid direct unsupported API assumptions", async () => {
  const clientSource = await readSource("../app/family/ioniq-dashboard/IoniqDashboardClient.js");

  assert.ok(clientSource.includes("if (!AudioContextCtor) return null;"));
  assert.ok(clientSource.includes("element?.requestFullscreen"));
  assert.ok(clientSource.includes("document.exitFullscreen"));
  assert.ok(clientSource.includes(".catch(() => {})"));
});
