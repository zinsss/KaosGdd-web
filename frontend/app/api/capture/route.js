import { NextResponse } from "next/server";

function supplyTitleFromCaptureRaw(raw) {
  const firstLine = String(raw || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine || !firstLine.startsWith("$$")) return "";
  return firstLine.slice(2).trim();
}

export async function POST(request) {
  const payload = await request.json();
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const supplyTitle = supplyTitleFromCaptureRaw(payload?.raw);

  const res = await fetch(base + (supplyTitle ? "/supplies" : "/capture"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(supplyTitle ? { title: supplyTitle } : payload),
    cache: "no-store",
  });

  const data = await res.json();
  if (supplyTitle && data?.ok) {
    return NextResponse.json({ ...data, kind: "supply" }, { status: res.status });
  }
  return NextResponse.json(data, { status: res.status });
}
