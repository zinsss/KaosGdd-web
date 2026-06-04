import test from "node:test";
import assert from "node:assert/strict";

import { formatEventCountGlyph } from "../lib/events/event-count-glyphs.js";

test("calendar event counts use preferred glyphs", () => {
  assert.equal(formatEventCountGlyph(0), "");
  assert.equal(formatEventCountGlyph(null), "");
  assert.equal(formatEventCountGlyph(1), "➊");
  assert.equal(formatEventCountGlyph(2), "➋");
  assert.equal(formatEventCountGlyph(3), "➌");
  assert.equal(formatEventCountGlyph(4), "➍");
  assert.equal(formatEventCountGlyph(5), "➎");
  assert.equal(formatEventCountGlyph(6), "➏");
  assert.equal(formatEventCountGlyph(7), "➐");
  assert.equal(formatEventCountGlyph(8), "➑");
  assert.equal(formatEventCountGlyph(9), "➒");
  assert.equal(formatEventCountGlyph(10), "➓");
  assert.equal(formatEventCountGlyph(25), "➓");
});
