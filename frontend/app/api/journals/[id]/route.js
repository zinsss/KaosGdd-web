import { NextResponse } from "next/server";

export async function DELETE(_request, context) {
  const id = context.params.id;
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const res = await fetch(base + "/journals/" + id, { method: "DELETE", cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
