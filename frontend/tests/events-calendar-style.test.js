import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlockForExactSelector(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  return match ? match[1] : "";
}

test("calendar event count renders as a plain yellow glyph", async () => {
  const eventsCss = await readFile(new URL("../app/styles/events.css", import.meta.url), "utf8");
  const countCss = cssBlockForExactSelector(eventsCss, ".eventCalCount");
  const selectedCss = cssBlockForExactSelector(eventsCss, ".eventCalCellSelected");
  const selectedTodayAfterCss = cssBlockForExactSelector(eventsCss, ".eventCalCellSelectedToday::after");
  const todayAfterCss = cssBlockForExactSelector(eventsCss, ".eventCalCellToday::after");
  const countChildrenCss = cssBlockForExactSelector(eventsCss, ".eventCalCount *");

  assert.match(countCss, /display:\s*inline-flex;/);
  assert.match(countCss, /min-width:\s*1\.25em;/);
  assert.match(countCss, /padding:\s*0;/);
  assert.match(countCss, /border:\s*0;/);
  assert.match(countCss, /border-radius:\s*0;/);
  assert.match(countCss, /background:\s*transparent;/);
  assert.match(countCss, /color:\s*var\(--ctp-yellow\);/);
  assert.match(countCss, /box-shadow:\s*none;/);
  assert.match(countCss, /text-shadow:\s*none;/);
  assert.doesNotMatch(countCss, /width:\s*22px;/);
  assert.doesNotMatch(countCss, /height:\s*22px;/);
  assert.doesNotMatch(countCss, /background:\s*var\(--ctp-yellow\);/);
  assert.doesNotMatch(countCss, /color:\s*var\(--ctp-crust\);/);
  assert.match(countChildrenCss, /background:\s*transparent;/);
  assert.match(countChildrenCss, /border:\s*0;/);
  assert.match(countChildrenCss, /box-shadow:\s*none;/);
  assert.match(countChildrenCss, /color:\s*inherit;/);
  assert.match(countChildrenCss, /text-shadow:\s*none;/);
  assert.doesNotMatch(selectedCss, /eventCalCount/);
  assert.doesNotMatch(selectedTodayAfterCss, /box-shadow:/);
  assert.match(todayAfterCss, /left:\s*7px;/);
  assert.doesNotMatch(todayAfterCss, /right:/);
});
