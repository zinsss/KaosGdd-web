import { NextResponse } from "next/server";

export async function POST(request) {
  const content = await request.arrayBuffer();
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const res = await fetch(base + "/fax/send-upload", {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") || "application/octet-stream",
      "x-file-name-url": request.headers.get("x-file-name-url") || "",
      "x-file-type": request.headers.get("x-file-type") || "",
      "x-fax-number": request.headers.get("x-fax-number") || "",
    },
    body: content,
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
