import { NextResponse } from "next/server";

import { getSuppliesApiBase } from "../supplies-api-base.js";

export async function GET() {
  const base = getSuppliesApiBase();
  const res = await fetch(base + "/supplies/presets", { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
