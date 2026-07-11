import { NextResponse } from "next/server";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function GET() {
  const res = await fetch(`${apiBase()}/family/links`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
