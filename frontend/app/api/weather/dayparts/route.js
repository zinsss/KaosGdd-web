import { NextResponse } from "next/server";

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const res = await fetch(base + "/weather/dayparts" + (query ? `?${query}` : ""), { cache: "no-store" });
  const data = await res.json().catch(() => ({
    ok: false,
    weather_dayparts_available: false,
    weather_unavailable_reason: "Weather info not available.",
    weather_dayparts: [],
  }));
  return NextResponse.json(data, { status: res.status });
}
