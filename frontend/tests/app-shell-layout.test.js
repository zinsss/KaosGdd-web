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

  assert.doesNotMatch(layoutSource, /appShellTopSpacer/);
  assert.match(topShellCss, /position:\s*sticky;/);
  assert.doesNotMatch(mainCss, /position:\s*fixed;/);
  assert.doesNotMatch(mainCss, /padding-top:\s*var\(--app-shell-content-offset\);/);
});

test("service worker bumps app-shell cache and checks for updates", async () => {
  const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const bootstrapSource = await readFile(
    new URL("../components/pwa/PwaBootstrap.js", import.meta.url),
    "utf8",
  );

  assert.match(serviceWorkerSource, /const SW_CACHE = "kaosgdd-app-shell-v2";/);
  assert.match(serviceWorkerSource, /keys\.filter\(\(key\) => key !== SW_CACHE\)/);
  assert.match(bootstrapSource, /registration\.update\(\)/);
});
