import { NextResponse } from "next/server";

import { getSuppliesApiBase } from "./supplies-api-base.js";

export async function GET(request) {
  const base = getSuppliesApiBase();
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const res = await fetch(base + "/supplies" + (query ? `?${query}` : ""), { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request) {
  const payload = await request.json();
  const base = getSuppliesApiBase();
  const res = await fetch(base + "/supplies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
