import test from "node:test";
import assert from "node:assert/strict";

import { describeEnabledPushState } from "../lib/pwa/push-status-state.js";

test("describeEnabledPushState handles backend missing", () => {
  const result = describeEnabledPushState({
    backend_subscription_saved: false,
    endpoint_match: false,
    last_test: null,
  });
  assert.equal(result.backendConnected, false);
  assert.match(result.message, /backend subscription is missing/i);
});

test("describeEnabledPushState handles backend connected", () => {
  const result = describeEnabledPushState({
    backend_subscription_saved: true,
    endpoint_match: true,
    last_test: { ok: true, sent: 1, removed: 0, last_test_at: "2026-04-24T10:00:00+00:00" },
  });
  assert.equal(result.backendConnected, true);
  assert.match(result.message, /backend connected/i);
  assert.match(result.deliveryStatus, /success/i);
});

test("describeEnabledPushState handles last test failed", () => {
  const result = describeEnabledPushState({
    backend_subscription_saved: true,
    endpoint_match: true,
    last_test: {
      ok: false,
      sent: 0,
      removed: 1,
      last_test_at: "2026-04-24T10:00:00+00:00",
      first_error_summary: "WebPushException: HTTP 410",
    },
  });
  assert.equal(result.backendConnected, true);
  assert.match(result.message, /last backend test push failed/i);
  assert.match(result.deliveryStatus, /HTTP 410/i);
});
