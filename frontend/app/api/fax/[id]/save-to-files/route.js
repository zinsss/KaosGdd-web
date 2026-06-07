import { NextResponse } from "next/server";

export async function POST(_request, { params }) {
  const { id } = await params;
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const res = await fetch(base + "/fax/" + id + "/save-to-files", {
    method: "POST",
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
