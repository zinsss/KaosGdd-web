import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../app/api/widget/summary/route.js";

test("widget summary proxy forwards to backend summary endpoint", async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE;
  const originalFetch = globalThis.fetch;
  const payload = {
    date: "2026.05.23 Sat",
    tasks: { overdue: 2, today: 3, active_total: 12 },
    reminders: { today: 1, missed: 0, fired: 0 },
    events_today: ["Claim Day"],
    flags: { public_holiday: false, market_day: true, claim_day: true },
  };

  process.env.NEXT_PUBLIC_API_BASE = "http://backend.test";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://backend.test/widget/summary");
    assert.deepEqual(options, { cache: "no-store" });
    return new Response(JSON.stringify(payload), {
      status: 203,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const res = await GET();
    assert.equal(res.status, 203);
    assert.deepEqual(await res.json(), payload);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) {
      delete process.env.NEXT_PUBLIC_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_API_BASE = originalBase;
    }
  }
});
