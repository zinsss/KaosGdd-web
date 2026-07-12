import { NextResponse } from "next/server";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function GET(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${apiBase()}/family/events${suffix}`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request) {
  const payload = await request.json();
  const res = await fetch(`${apiBase()}/family/events`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
