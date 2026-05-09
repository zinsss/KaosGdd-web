import { NextResponse } from "next/server";

function getBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function PATCH(request, { params }) {
  const payload = await request.json();
  const { id } = await params;
  const res = await fetch(`${getBase()}/scribbles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const res = await fetch(`${getBase()}/scribbles/${id}`, {
    method: "DELETE",
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
