import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

test("fax attention count makes title attention strong", () => {
  assert.equal(hasStrongTitleAttention({ has_attention_fax: true, strong_attention_count: 1 }), true);
  assert.match(
    getAppHeaderTitleClassName({ has_attention_fax: true, strong_attention_count: 1 }),
    /\bappHeaderTitleAttention\b/,
  );
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

test("successful zero strong attention count resets stale title attention", () => {
  const className = getAppHeaderTitleClassName({
    has_strong_attention: true,
    strong_attention_count: 0,
    has_overdue_tasks: false,
    has_unacked_reminders: false,
    has_missed_reminders: false,
    has_attention_fax: false,
  });

  assert.equal(className, "appHeaderTitle appHeaderTitleLink");
});

test("positive strong attention count makes title attention explicit", () => {
  assert.equal(hasStrongTitleAttention({ strong_attention_count: 2 }), true);
  assert.match(getAppHeaderTitleClassName({ strong_attention_count: 2 }), /\bappHeaderTitleAttention\b/);
});

test("app title css keeps default yellow and attention maroon explicit", async () => {
  const css = await readFile(new URL("../app/styles/shell.css", import.meta.url), "utf8");

  assert.match(css, /\.appHeaderTitle\s*\{[^}]*color:\s*var\(--ctp-yellow\);/s);
  assert.match(css, /\.appHeaderTitleLink:visited\s*\{[^}]*color:\s*var\(--ctp-yellow\);/s);
  assert.match(css, /\.appHeaderTitleAttention,[\s\S]*?\.appHeaderTitleAttention:visited\s*\{[^}]*color:\s*var\(--ctp-maroon\);/s);
});

test("app header preserves latest known status when nav-status fetch fails", async () => {
  const source = await readFile(new URL("../components/AppHeaderTitle.js", import.meta.url), "utf8");

  assert.match(source, /catch\s*\{\s*return;\s*\}/);
  assert.doesNotMatch(source, /catch\s*\{[\s\S]*setStatus\(\{\s*\.\.\.DEFAULT_MODULE_NAV_STATUS\s*\}\)/);
  assert.doesNotMatch(source, /catch\s*\{[\s\S]*updateAppBadge\(0\)/);
});
