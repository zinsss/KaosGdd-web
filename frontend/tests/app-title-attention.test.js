import test from "node:test";
import assert from "node:assert/strict";

import { getAppHeaderTitleClassName, hasStrongTitleAttention } from "../lib/app-title-attention.js";

test("overdue active task makes title attention strong", () => {
  assert.equal(hasStrongTitleAttention({ has_overdue_tasks: true }), true);
  assert.match(getAppHeaderTitleClassName({ has_overdue_tasks: true }), /\bappHeaderTitleAttention\b/);
});

test("fired unacked reminder makes title attention strong", () => {
  assert.equal(hasStrongTitleAttention({ has_unacked_reminders: true }), true);
  assert.match(getAppHeaderTitleClassName({ has_unacked_reminders: true }), /\bappHeaderTitleAttention\b/);
});

test("missed unacked reminder makes title attention strong", () => {
  assert.equal(hasStrongTitleAttention({ has_missed_reminders: true }), true);
  assert.match(getAppHeaderTitleClassName({ has_missed_reminders: true }), /\bappHeaderTitleAttention\b/);
});

test("resolved reminders do not make title attention strong", () => {
  for (const state of ["acked", "snoozed", "completed", "cancelled"]) {
    assert.equal(hasStrongTitleAttention({ reminder_state: state }), false);
  }
});

test("normal status keeps title color unchanged", () => {
  const className = getAppHeaderTitleClassName({
    has_overdue_tasks: false,
    has_unacked_reminders: false,
    has_missed_reminders: false,
  });

  assert.equal(className, "appHeaderTitle appHeaderTitleLink");
});
