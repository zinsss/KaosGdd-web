import { NextResponse } from "next/server";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function GET(_request, context) {
  const { key } = await context.params;
  const res = await fetch(`${apiBase()}/family/records/${encodeURIComponent(key)}`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request, context) {
  const { key } = await context.params;
  const payload = await request.json();
  const res = await fetch(`${apiBase()}/family/records/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
