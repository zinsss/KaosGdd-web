import test from "node:test";
import assert from "node:assert/strict";

import { KAOSGDD_STATUS_CHANGED_EVENT, dispatchAppStatusChanged } from "../lib/app-status-events.js";

test("dispatchAppStatusChanged emits the global status changed event", () => {
  const originalWindow = globalThis.window;
  const target = new EventTarget();
  const detail = { source: "task", action: "done" };
  let receivedDetail = null;

  target.addEventListener(KAOSGDD_STATUS_CHANGED_EVENT, (event) => {
    receivedDetail = event.detail;
  });

  globalThis.window = target;

  try {
    dispatchAppStatusChanged(detail);
    assert.deepEqual(receivedDetail, detail);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test("dispatchAppStatusChanged is a no-op without window", () => {
  const originalWindow = globalThis.window;

  if (originalWindow !== undefined) {
    delete globalThis.window;
  }

  try {
    assert.doesNotThrow(() => dispatchAppStatusChanged({ source: "test" }));
  } finally {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
  }
});
