import { NextResponse } from "next/server";

import { getApiBase } from "../../../../lib/api-base";

export async function GET() {
  const API_BASE = getApiBase();
  const res = await fetch(`${API_BASE}/push/notification-preferences`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(request) {
  const API_BASE = getApiBase();
  const payload = await request.json();
  const res = await fetch(`${API_BASE}/push/notification-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
