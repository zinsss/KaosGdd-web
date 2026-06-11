import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function cssBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  return match ? match[0] : "";
}

test("calendar event count badge stays visually independent of selected and today states", async () => {
  const eventsCss = await readFile(new URL("../app/styles/events.css", import.meta.url), "utf8");
  const countCss = cssBlock(eventsCss, ".eventCalCount");
  const selectedCss = cssBlock(eventsCss, ".eventCalCellSelected");
  const selectedTodayAfterCss = cssBlock(eventsCss, ".eventCalCellSelectedToday::after");
  const todayAfterCss = cssBlock(eventsCss, ".eventCalCellToday::after");

  assert.match(countCss, /background:\s*var\(--ctp-yellow\);/);
  assert.match(countCss, /color:\s*var\(--ctp-crust\);/);
  assert.match(countCss, /box-shadow:\s*none;/);
  assert.doesNotMatch(countCss, /background:\s*var\(--ui-panel\);/);
  assert.doesNotMatch(selectedCss, /eventCalCount/);
  assert.doesNotMatch(selectedTodayAfterCss, /box-shadow:/);
  assert.match(todayAfterCss, /left:\s*7px;/);
  assert.doesNotMatch(todayAfterCss, /right:/);
});
