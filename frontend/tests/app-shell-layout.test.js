import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("fixed top shell offsets the real scroll container instead of using a spacer", async () => {
  const layoutSource = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
  const shellCss = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.doesNotMatch(layoutSource, /appShellTopSpacer/);
  assert.match(shellCss, /\.appShellMain\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(shellCss, /\.appShellMain\s*\{[\s\S]*padding-top:\s*var\(--app-shell-content-offset\);/);
  assert.match(shellCss, /\.appShellMain\s*\{[\s\S]*scroll-padding-top:\s*var\(--app-shell-content-offset\);/);
});
