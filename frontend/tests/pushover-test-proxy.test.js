import test from "node:test";
import assert from "node:assert/strict";

import { POST } from "../app/api/push/pushover-test/route.js";

test("pushover test proxy forwards to backend pushover test endpoint", async () => {
  const originalBase = process.env.NEXT_PUBLIC_API_BASE;
  const originalFetch = globalThis.fetch;
  const payload = { ok: true, attempted: true, succeeded: true, reason: null };

  process.env.NEXT_PUBLIC_API_BASE = "http://backend.test";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://backend.test/push/pushover-test");
    assert.deepEqual(options, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    return new Response(JSON.stringify(payload), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const res = await POST();
    assert.equal(res.status, 202);
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
