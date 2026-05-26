import test from "node:test";
import assert from "node:assert/strict";

import { UI_STRINGS } from "../lib/strings.js";
import { sendPushoverTest } from "../lib/pwa/pushover-test.js";

test("sendPushoverTest posts to the separate pushover test route", async () => {
  const originalFetch = globalThis.fetch;
  const payload = { ok: true, attempted: true, succeeded: true, reason: null };

  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/push/pushover-test");
    assert.deepEqual(options, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    assert.deepEqual(await sendPushoverTest(), payload);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendPushoverTest reports backend failure reason", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, reason: "missing credentials" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(sendPushoverTest(), new RegExp(`${UI_STRINGS.PUSHOVER_TEST_FAILED} \\(missing credentials\\)`));
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("sendPushoverTest reports request failures with centralized string", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("network down");
  };

  try {
    await assert.rejects(sendPushoverTest(), new RegExp(UI_STRINGS.PUSHOVER_TEST_REQUEST_FAILED));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
