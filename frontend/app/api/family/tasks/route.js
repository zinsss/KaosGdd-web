import { NextResponse } from "next/server";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function GET() {
  const res = await fetch(`${apiBase()}/family/tasks`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request) {
  const payload = await request.json();
  const res = await fetch(`${apiBase()}/family/tasks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
