import test from "node:test";
import assert from "node:assert/strict";

import { getModeSwipeStep, isModeSwipeInteractiveTarget } from "../lib/use-mode-swipe.js";

test("mode swipe helper returns one step for clear horizontal gestures", () => {
  assert.equal(getModeSwipeStep({ startX: 200, startY: 100, endX: 120, endY: 106 }), 1);
  assert.equal(getModeSwipeStep({ startX: 120, startY: 100, endX: 200, endY: 106 }), -1);
});

test("mode swipe helper ignores short or mostly vertical gestures", () => {
  assert.equal(getModeSwipeStep({ startX: 200, startY: 100, endX: 160, endY: 102 }), 0);
  assert.equal(getModeSwipeStep({ startX: 200, startY: 100, endX: 130, endY: 180 }), 0);
});

test("mode swipe interactive-target guard only ignores controls and links", () => {
  const linkChild = {
    closest(selector) {
      assert.equal(selector, "a, button, input, textarea, select, option");
      return { tagName: "A" };
    },
  };
  const plainPage = {
    closest(selector) {
      assert.equal(selector, "a, button, input, textarea, select, option");
      return null;
    },
  };

  assert.equal(isModeSwipeInteractiveTarget(linkChild), true);
  assert.equal(isModeSwipeInteractiveTarget(plainPage), false);
});
