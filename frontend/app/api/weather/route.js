import { NextResponse } from "next/server";

export async function GET(request) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(base + "/api/weather" + suffix, { cache: "no-store" });
  const data = await res.json().catch(() => ({ ok: false, locations: [] }));
  return NextResponse.json(data, { status: res.status });
}
