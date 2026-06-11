import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  return match ? match[0] : "";
}

test("top nav edge indicators are accessible scroll buttons", async () => {
  const topNavSource = await readFile(new URL("../components/TopNav.js", import.meta.url), "utf8");
  const globalsCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const scrollButtonCss = await readFile(
    new URL("../app/styles/top-nav-scroll-buttons.css", import.meta.url),
    "utf8",
  );
  const scrollHintCss = cssBlock(scrollButtonCss, ".topNavScrollHint");

  assert.match(topNavSource, /topNavWrapCanScrollLeft/);
  assert.match(topNavSource, /topNavWrapCanScrollRight/);
  assert.match(topNavSource, /const scrollNavigation = useCallback/);
  assert.match(topNavSource, /navScroll\.scrollBy\(\{/);
  assert.match(topNavSource, /left:\s*direction \* Math\.max\(120, navScroll\.clientWidth \* 0\.7\)/);
  assert.match(topNavSource, /behavior:\s*"smooth"/);
  assert.match(topNavSource, /type="button"/);
  assert.match(topNavSource, /aria-label="Scroll navigation left"/);
  assert.match(topNavSource, /aria-label="Scroll navigation right"/);
  assert.match(topNavSource, /hidden=\{!scrollHints\.left\}/);
  assert.match(topNavSource, /hidden=\{!scrollHints\.right\}/);
  assert.doesNotMatch(topNavSource, /<span className="topNavScrollHint/);
  assert.match(globalsCss, /@import "\.\/styles\/top-nav-scroll-buttons\.css";/);
  assert.match(scrollHintCss, /pointer-events:\s*auto;/);
  assert.match(scrollHintCss, /width:\s*32px;/);
  assert.match(scrollButtonCss, /\.topNavScrollHint\[hidden\]\s*\{\s*display:\s*none;/);
});
