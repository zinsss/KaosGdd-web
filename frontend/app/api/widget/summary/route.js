import { NextResponse } from "next/server.js";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const res = await fetch(base + "/widget/summary", { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
