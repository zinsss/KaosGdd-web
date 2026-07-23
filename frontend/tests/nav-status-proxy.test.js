import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  GET,
  isAttentionFax,
  isAttentionReminder,
  isOverdueTask,
  summarizeAttentionFax,
  summarizeAttentionReminder,
} from "../app/api/nav-status/route.js";

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
  assert.equal(isAttentionFax({ status: "active", direction: "incoming", fax_status: "received", saved_file_id: "file1" }), false);
});

test("nav status summarizes attention reminders and faxes for the shell box", () => {
  assert.deepEqual(
    summarizeAttentionReminder({
      id: "r1",
      title: "Call pharmacy",
      state: "missed",
      remind_at_display: "Today 09:30",
    }),
    {
      id: "r1",
      title: "Call pharmacy",
      state: "missed",
      when: "Today 09:30",
      href: "/reminders?mode=fired&reminder_id=r1",
    },
  );

  assert.deepEqual(
    summarizeAttentionFax({
      id: "fax1",
      title: "Lab result",
      status: "active",
      direction: "incoming",
      fax_status: "received",
      received_at_display: "Today 10:00",
    }),
    {
      id: "fax1",
      title: "Lab result",
      direction: "incoming",
      fax_status: "received",
      when: "Today 10:00",
      error_message: "",
      href: "/fax/fax1",
    },
  );
});

test("nav status proxy returns strong attention for fired unacked reminders", async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE;
  const originalSuppliesBase = process.env.SUPPLIES_API_BASE;
  const originalFetch = globalThis.fetch;
  const calls = [];

  process.env.NEXT_PUBLIC_API_BASE = "http://backend.test";
  process.env.SUPPLIES_API_BASE = "http://supplies.test";
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);

    const payloadByUrl = {
      "http://backend.test/tasks": { items: [] },
      "http://supplies.test/supplies?mode=active": { items: [] },
      "http://backend.test/reminders?mode=active": { items: [] },
      "http://backend.test/reminders?mode=fired": {
        items: [{ id: "r1", title: "Wake up", state: "fired", remind_at_display: "Today 07:00" }],
      },
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
    assert.equal(data.attention_reminder_count, 1);
    assert.deepEqual(data.attention_reminders, [
      {
        id: "r1",
        title: "Wake up",
        state: "fired",
        when: "Today 07:00",
        href: "/reminders?mode=fired&reminder_id=r1",
      },
    ]);
    assert.ok(calls.some(([url]) => url === "http://backend.test/reminders?mode=fired"));
    assert.ok(calls.some(([url]) => url === "http://supplies.test/supplies?mode=active"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = originalBase;
    }
    if (originalSuppliesBase === undefined) {
      delete process.env.SUPPLIES_API_BASE;
    } else {
      process.env.SUPPLIES_API_BASE = originalSuppliesBase;
    }
  }
});

test("nav status proxy includes active fax attention in strong count", async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE;
  const originalSuppliesBase = process.env.SUPPLIES_API_BASE;
  const originalFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_API_BASE = "http://backend.test";
  process.env.SUPPLIES_API_BASE = "http://supplies.test";
  globalThis.fetch = async (url) => {
    const payloadByUrl = {
      "http://backend.test/tasks": { items: [] },
      "http://supplies.test/supplies?mode=active": { items: [] },
      "http://backend.test/reminders?mode=active": { items: [] },
      "http://backend.test/reminders?mode=fired": { items: [] },
      "http://backend.test/fax?mode=active": {
        items: [
          { id: "fax1", status: "active", direction: "incoming", fax_status: "received" },
          { id: "fax2", status: "active", direction: "outgoing", fax_status: "failed" },
          { id: "fax3", status: "active", direction: "outgoing", fax_status: "queued" },
          { id: "fax4", status: "removed", direction: "incoming", fax_status: "received" },
          { id: "fax5", status: "active", direction: "incoming", fax_status: "received", saved_file_id: "file1" },
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
    assert.equal(data.attention_fax_count, 2);
    assert.deepEqual(
      data.attention_faxes.map((fax) => [fax.id, fax.fax_status, fax.href]),
      [
        ["fax1", "received", "/fax/fax1"],
        ["fax2", "failed", "/fax/fax2"],
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = originalBase;
    }
    if (originalSuppliesBase === undefined) {
      delete process.env.SUPPLIES_API_BASE;
    } else {
      process.env.SUPPLIES_API_BASE = originalSuppliesBase;
    }
  }
});

test("nav status proxy splits supplies from the main KaosGdd backend", async () => {
  const source = await readFile(new URL("../app/api/nav-status/route.js", import.meta.url), "utf8");

  assert.match(source, /function getMainApiBase\(\)/);
  assert.match(source, /function getSuppliesApiBase\(\)/);
  assert.match(source, /SUPPLIES_API_BASE/);
  assert.match(source, /suppliesBase \+ ["']\/supplies\?mode=active["']/);
});
