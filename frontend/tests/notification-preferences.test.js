import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NOTIFICATION_MODE,
  DEFAULT_NOTIFICATION_MODES,
  NOTIFICATION_MODE_DESCRIPTIONS,
  NOTIFICATION_MODE_LABELS,
  normalizeNotificationMode,
  normalizeNotificationPreferencesPayload,
} from "../lib/pwa/notification-preferences.js";

test("notification constants expose only active user-facing modes", () => {
  assert.equal(DEFAULT_NOTIFICATION_MODE, "pushover_primary");
  assert.deepEqual(DEFAULT_NOTIFICATION_MODES, ["pushover_primary", "web_push_only", "pushover_only"]);
  assert.equal(NOTIFICATION_MODE_LABELS.pushover_primary, "Pushover primary");
  assert.equal(NOTIFICATION_MODE_LABELS.hybrid, undefined);
  assert.equal(NOTIFICATION_MODE_DESCRIPTIONS.hybrid, undefined);
});

test("legacy hybrid notification mode normalizes to pushover primary", () => {
  assert.equal(normalizeNotificationMode("hybrid"), "pushover_primary");
  assert.equal(normalizeNotificationMode("web_push_only"), "web_push_only");
  assert.equal(normalizeNotificationMode("bad-mode"), "pushover_primary");
});

test("legacy hybrid response is normalized and not exposed as supported mode", () => {
  const normalized = normalizeNotificationPreferencesPayload({
    ok: true,
    preferences: { mode: "hybrid" },
    supported_modes: ["hybrid", "web_push_only", "pushover_only"],
  });

  assert.equal(normalized.preferences.mode, "pushover_primary");
  assert.deepEqual(normalized.supported_modes, ["pushover_primary", "web_push_only", "pushover_only"]);
});
