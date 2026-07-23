import { NextResponse } from "next/server";

import { getSuppliesApiBase } from "../supplies-api-base.js";

export async function DELETE(_request, context) {
  const { id } = await context.params;
  const base = getSuppliesApiBase();
  const res = await fetch(base + "/supplies/" + id, {
    method: "DELETE",
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
