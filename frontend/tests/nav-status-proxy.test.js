import test from "node:test";
import assert from "node:assert/strict";

import { GET, isAttentionFax, isAttentionReminder, isOverdueTask } from "../app/api/nav-status/route.js";

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

test("nav status counts active received and failed faxes as attention only", () => {
  assert.equal(isAttentionFax({ status: "active", direction: "incoming", fax_status: "received" }), true);
  assert.equal(isAttentionFax({ status: "active", direction: "outgoing", fax_status: "failed" }), true);
  assert.equal(isAttentionFax({ status: "active", direction: "outgoing", fax_status: "conversion_failed" }), true);

  assert.equal(isAttentionFax({ status: "active", direction: "incoming", fax_status: "conversion_failed" }), false);
  assert.equal(isAttentionFax({ status: "active", direction: "outgoing", fax_status: "queued" }), false);
  assert.equal(isAttentionFax({ status: "removed", direction: "incoming", fax_status: "received" }), false);
  assert.equal(isAttentionFax({ status: "archived", direction: "outgoing", fax_status: "failed" }), false);
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
      "http://backend.test/fax?mode=active": { items: [] },
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
    assert.equal(data.strong_attention_count, 1);
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

test("nav status proxy includes active fax attention in strong count", async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE;
  const originalFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_API_BASE = "http://backend.test";
  globalThis.fetch = async (url) => {
    const payloadByUrl = {
      "http://backend.test/tasks": { items: [] },
      "http://backend.test/supplies?mode=active": { items: [] },
      "http://backend.test/reminders?mode=active": { items: [] },
      "http://backend.test/reminders?mode=fired": { items: [] },
      "http://backend.test/fax?mode=active": {
        items: [
          { id: "fax1", status: "active", direction: "incoming", fax_status: "received" },
          { id: "fax2", status: "active", direction: "outgoing", fax_status: "failed" },
          { id: "fax3", status: "active", direction: "outgoing", fax_status: "queued" },
          { id: "fax4", status: "removed", direction: "incoming", fax_status: "received" },
        ],
      },
    };

    if (String(url).startsWith("http://backend.test/events?")) {
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }

    return new Response(JSON.stringify(payloadByUrl[url] || { items: [] }), { status: 200 });
  };

  try {
    const res = await GET();
    const data = await res.json();

    assert.equal(data.has_attention_fax, true);
    assert.equal(data.has_strong_attention, true);
    assert.equal(data.strong_attention_count, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = originalBase;
    }
  }
});
