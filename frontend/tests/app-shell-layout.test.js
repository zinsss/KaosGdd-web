import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  return match ? match[0] : "";
}

test("top shell stays in flow so page controls are not covered", async () => {
  const layoutSource = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");
  const topShellCss = cssBlock(shellCss, ".appShellTop");
  const mainCss = cssBlock(shellCss, ".appShellMain");
  const modeNavCss = cssBlock(shellCss, ".modeTextLinks");

  assert.doesNotMatch(layoutSource, /appShellTopSpacer/);
  assert.match(topShellCss, /position:\s*sticky;/);
  assert.doesNotMatch(mainCss, /position:\s*fixed;/);
  assert.doesNotMatch(mainCss, /padding-top:\s*var\(--app-shell-content-offset\);/);
  assert.match(modeNavCss, /pointer-events:\s*auto;/);
});

test("service worker bumps app-shell cache and checks for updates", async () => {
  const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const bootstrapSource = await readFile(
    new URL("../components/pwa/PwaBootstrap.js", import.meta.url),
    "utf8",
  );

  assert.match(serviceWorkerSource, /const SW_CACHE = "kaosgdd-app-shell-v4";/);
  assert.match(serviceWorkerSource, /key\.startsWith\("kaosgdd-app-shell-"\)/);
  assert.doesNotMatch(serviceWorkerSource, /"\/tasks"/);
  assert.doesNotMatch(serviceWorkerSource, /"\/reminders"/);
  assert.match(bootstrapSource, /registration\.update\(\)/);
});

test("debug tap panel is gated by debugTap query parameter", async () => {
  const layoutSource = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
  const debugTapSource = await readFile(new URL("../components/DebugTapPanel.js", import.meta.url), "utf8");

  assert.match(layoutSource, /<DebugTapPanel \/>/);
  assert.match(debugTapSource, /params\.get\("debugTap"\) === "1"/);
  assert.match(debugTapSource, /document\.addEventListener\("pointerdown", onEvent, true\)/);
  assert.match(debugTapSource, /document\.addEventListener\("click", onEvent, true\)/);
  assert.match(debugTapSource, /document\.addEventListener\("touchstart", onEvent, true\)/);
});
