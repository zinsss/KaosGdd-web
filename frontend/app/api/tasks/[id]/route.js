import { NextResponse } from "next/server";

export async function PATCH(request, context) {
  const id = context.params.id;
  const payload = await request.json();
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const res = await fetch(base + "/tasks/" + id, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
export async function DELETE(_request, context) {
  const id = context.params.id;
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  const res = await fetch(base + "/tasks/" + id, {
    method: "DELETE",
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

