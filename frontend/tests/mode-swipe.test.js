import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createModeSwipeState,
  getModeSwipeMoveResult,
  isModeSwipeInteractiveTarget,
} from "../lib/use-mode-swipe.js";

test("mode swipe helper returns one step during clear left and right touchmove gestures", () => {
  const left = getModeSwipeMoveResult({
    state: createModeSwipeState({ tracking: true, startX: 200, startY: 100 }),
    currentX: 120,
    currentY: 106,
  });
  const right = getModeSwipeMoveResult({
    state: createModeSwipeState({ tracking: true, startX: 120, startY: 100 }),
    currentX: 200,
    currentY: 106,
  });

  assert.equal(left.step, 1);
  assert.equal(left.nextState.axis, "x");
  assert.equal(left.nextState.handled, true);
  assert.equal(right.step, -1);
  assert.equal(right.nextState.axis, "x");
  assert.equal(right.nextState.handled, true);
});

test("mode swipe helper fires only once after a gesture is handled", () => {
  const first = getModeSwipeMoveResult({
    state: createModeSwipeState({ tracking: true, startX: 200, startY: 100 }),
    currentX: 120,
    currentY: 106,
  });
  const second = getModeSwipeMoveResult({
    state: first.nextState,
    currentX: 80,
    currentY: 106,
  });

  assert.equal(first.step, 1);
  assert.equal(second.step, 0);
});

test("mode swipe helper ignores short or mostly vertical touchmove gestures", () => {
  const short = getModeSwipeMoveResult({
    state: createModeSwipeState({ tracking: true, startX: 200, startY: 100 }),
    currentX: 160,
    currentY: 102,
  });
  const vertical = getModeSwipeMoveResult({
    state: createModeSwipeState({ tracking: true, startX: 200, startY: 100 }),
    currentX: 130,
    currentY: 180,
  });

  assert.equal(short.step, 0);
  assert.equal(short.nextState.axis, "x");
  assert.equal(short.nextState.handled, false);
  assert.equal(vertical.step, 0);
  assert.equal(vertical.nextState.axis, "y");
  assert.equal(vertical.nextState.handled, false);
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

test("useModeSwipe exposes touchmove and keeps touchend as cleanup", async () => {
  const source = await readFile(new URL("../lib/use-mode-swipe.js", import.meta.url), "utf8");

  assert.match(source, /function onTouchMove/);
  assert.match(source, /onTouchMove,/);
  assert.match(source, /onTouchEnd: clearTouchTracking/);
});
