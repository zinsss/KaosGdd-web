import test from "node:test";
import assert from "node:assert/strict";

import { GET, isAttentionReminder, isOverdueTask } from "../app/api/nav-status/route.js";

test("nav status treats active overdue tasks as overdue only when active and open", () => {
  const nowMs = Date.parse("2026-05-30T12:00:00Z");

  assert.equal(isOverdueTask({ status: "active", due_at: "2026-05-30T10:00:00Z" }, nowMs), true);
  assert.equal(isOverdueTask({ status: "active", is_done: true, due_at: "2026-05-30T10:00:00Z" }, nowMs), false);
  assert.equal(isOverdueTask({ status: "removed", due_at: "2026-05-30T10:00:00Z" }, nowMs), false);
  assert.equal(isOverdueTask({ status: "archived", due_at: "2026-05-30T10:00:00Z" }, nowMs), false);
  assert.equal(isOverdueTask({ status: "active", due_at: "2026-05-31T10:00:00Z" }, nowMs), false);
});

test("nav status counts fired and missed reminders as attention only", () => {
  assert.equal(isAttentionReminder({ state: "fired" }), true);
  assert.equal(isAttentionReminder({ state: "missed" }), true);

  for (const state of ["acked", "snoozed", "completed", "cancelled"]) {
    assert.equal(isAttentionReminder({ state }), false);
  }
});

test("nav status proxy returns strong attention for fired unacked reminders", async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE;
  const originalFetch = globalThis.fetch;
  const calls = [];

  process.env.NEXT_PUBLIC_API_BASE = "http://backend.test";
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);

    const payloadByUrl = {
      "http://backend.test/tasks": { items: [] },
      "http://backend.test/supplies?mode=active": { items: [] },
      "http://backend.test/reminders?mode=active": { items: [] },
      "http://backend.test/reminders?mode=fired": { items: [{ id: "r1", state: "fired" }] },
    };

    if (String(url).startsWith("http://backend.test/events?")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }

    return new Response(JSON.stringify(payloadByUrl[url] || { items: [] }), { status: 200 });
  };

  try {
    const res = await GET();
    const data = await res.json();

    assert.equal(data.has_unacked_reminders, true);
    assert.equal(data.has_strong_attention, true);
    assert.equal(data.has_missed_reminders, false);
    assert.ok(calls.some(([url]) => url === "http://backend.test/reminders?mode=fired"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = originalBase;
    }
  }
});
