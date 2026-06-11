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
  assert.match(debugTapSource, /const \[eventLog, setEventLog\] = useState\(\[\]\);/);
  assert.match(debugTapSource, /\[nextInfo, \.\.\.currentLog\]\.slice\(0, 10\)/);
  assert.match(debugTapSource, /timestamp/);
  assert.match(debugTapSource, /url: `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`/);
  assert.match(debugTapSource, /document\.addEventListener\("pointerdown", onEvent, true\)/);
  assert.match(debugTapSource, /document\.addEventListener\("click", onEvent, true\)/);
  assert.match(debugTapSource, /document\.addEventListener\("touchstart", onEvent, true\)/);
});

test("attention box is mounted as a standalone card below capture shell", async () => {
  const layoutSource = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
  const observerSource = await readFile(new URL("../components/AppShellHeightObserver.js", import.meta.url), "utf8");
  const attentionBoxSource = await readFile(new URL("../components/AttentionBox.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");
  const attentionBoxCss = await readFile(new URL("../app/styles/attention-box.css", import.meta.url), "utf8");

  assert.match(layoutSource, /<TopNav \/>\s*<TopCaptureBar \/>/);
  assert.doesNotMatch(layoutSource, /<TopNav \/>\s*<AttentionBox \/>\s*<TopCaptureBar \/>/);
  assert.match(layoutSource, /<\/header>\s*<div className="appShellAttentionSlot">\s*<AttentionBox \/>\s*<\/div>\s*<main className="appShellMain">/);
  assert.match(observerSource, /\.appShellAttentionSlot/);
  assert.match(observerSource, /shellHeight \+ attentionHeight/);
  assert.match(attentionBoxSource, /DISMISSED_SIGNATURE_KEY/);
  assert.match(attentionBoxSource, /KAOSGDD_STATUS_CHANGED_EVENT/);
  assert.match(globalsCss, /@import "\.\/styles\/attention-box\.css";/);
  assert.match(shellCss, /\.appShellAttentionSlot\s*\{/);
  assert.match(attentionBoxCss, /max-width:\s*var\(--app-column-max-width\);/);
  assert.match(attentionBoxCss, /\.attentionBoxClose\s*\{/);
});

test("major app card spacing uses the shared spacing token", async () => {
  const tokensCss = await readFile(new URL("../app/styles/tokens.css", import.meta.url), "utf8");
  const baseCss = await readFile(new URL("../app/styles/base.css", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const spacingCss = await readFile(new URL("../app/styles/spacing.css", import.meta.url), "utf8");
  const attentionBoxCss = await readFile(new URL("../app/styles/attention-box.css", import.meta.url), "utf8");
  const dashboardCss = await readFile(new URL("../app/styles/dashboard.css", import.meta.url), "utf8");

  const pageCss = cssBlock(baseCss, ".page");
  const panelCss = cssBlock(baseCss, ".panel");
  const topShellCss = cssBlock(spacingCss, ".appShellTop");
  const attentionBoxCssBlock = cssBlock(attentionBoxCss, ".attentionBox");
  const dashboardPageCss = cssBlock(dashboardCss, ".dashboardPage");
  const dashboardGridCss = cssBlock(dashboardCss, ".dashboardGrid");

  assert.match(tokensCss, /--app-card-gap:\s*8px;/);
  assert.match(globalsCss, /@import "\.\/styles\/spacing\.css";/);
  assert.match(spacingCss, /--app-shell-content-gap:\s*var\(--app-card-gap\);/);
  assert.match(topShellCss, /padding-bottom:\s*var\(--app-card-gap\);/);
  assert.match(pageCss, /padding:\s*0 0 var\(--app-card-gap\);/);
  assert.match(panelCss, /margin-bottom:\s*var\(--app-card-gap\);/);
  assert.match(attentionBoxCssBlock, /margin:\s*0 auto var\(--app-card-gap\);/);
  assert.match(dashboardPageCss, /gap:\s*var\(--app-card-gap\);/);
  assert.match(dashboardGridCss, /gap:\s*var\(--app-card-gap\);/);
  assert.match(dashboardCss, /\.dashboardPage > \.panel,\s*\.dashboardGrid > \.panel\s*\{\s*margin-bottom:\s*0;/);
});
