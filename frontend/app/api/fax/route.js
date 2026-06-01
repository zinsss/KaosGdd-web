import { NextResponse } from "next/server";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function GET(request) {
  const base = getApiBase();
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const res = await fetch(base + "/fax" + (query ? `?${query}` : ""), { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
