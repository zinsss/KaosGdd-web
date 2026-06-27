import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const res = await fetch(base + "/api/weather", { cache: "no-store" });
  const data = await res.json().catch(() => ({ ok: false, locations: [] }));
  return NextResponse.json(data, { status: res.status });
}
