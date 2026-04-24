import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id") || "";
  const endpoint = searchParams.get("endpoint") || "";
  const apiUrl = new URL(`${API_BASE}/push/status`);
  apiUrl.searchParams.set("client_id", clientId);
  if (endpoint) {
    apiUrl.searchParams.set("endpoint", endpoint);
  }

  const res = await fetch(apiUrl.toString(), { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
