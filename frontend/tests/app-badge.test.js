import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAppBadgeCount, updateAppBadge } from "../lib/app-badge.js";

function withNavigator(navigatorValue, callback) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigatorValue,
  });

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "navigator", originalDescriptor);
      } else {
        delete globalThis.navigator;
      }
    });
}

test("updateAppBadge calls navigator.setAppBadge when count is positive", async () => {
  let setCount = null;
  let clearCalled = false;

  await withNavigator(
    {
      setAppBadge: async (count) => {
        setCount = count;
      },
      clearAppBadge: async () => {
        clearCalled = true;
      },
    },
    async () => {
      await updateAppBadge(3);
    },
  );

  assert.equal(setCount, 3);
  assert.equal(clearCalled, false);
});

test("normalizeAppBadgeCount clamps invalid or negative counts", () => {
  assert.equal(normalizeAppBadgeCount(3), 3);
  assert.equal(normalizeAppBadgeCount("2"), 2);
  assert.equal(normalizeAppBadgeCount(-5), 0);
  assert.equal(normalizeAppBadgeCount("not-a-number"), 0);
});

test("updateAppBadge calls navigator.clearAppBadge when count is zero", async () => {
  let setCalled = false;
  let clearCalled = false;

  await withNavigator(
    {
      setAppBadge: async () => {
        setCalled = true;
      },
      clearAppBadge: async () => {
        clearCalled = true;
      },
    },
    async () => {
      await updateAppBadge(0);
    },
  );

  assert.equal(setCalled, false);
  assert.equal(clearCalled, true);
});

test("updateAppBadge does not throw when app badge API is unsupported", async () => {
  await withNavigator({}, async () => {
    await assert.doesNotReject(() => updateAppBadge(2));
    await assert.doesNotReject(() => updateAppBadge(0));
  });
});

test("updateAppBadge does not throw when app badge API rejects", async () => {
  await withNavigator(
    {
      setAppBadge: async () => {
        throw new Error("unsupported");
      },
      clearAppBadge: async () => {
        throw new Error("unsupported");
      },
    },
    async () => {
      await assert.doesNotReject(() => updateAppBadge(2));
      await assert.doesNotReject(() => updateAppBadge(0));
    },
  );
});
