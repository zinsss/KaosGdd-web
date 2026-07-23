import { NextResponse } from "next/server";

import { getSuppliesApiBase } from "../../supplies-api-base.js";

export async function POST(request) {
  const payload = await request.json();
  const base = getSuppliesApiBase();
  const res = await fetch(base + "/supplies/presets/use", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
