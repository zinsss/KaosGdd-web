import { NextResponse } from "next/server.js";

import { readPendingShareBytes } from "../../../../../lib/pending-share-store.js";

const MISSING_ERROR = "shared file expired or missing";

export async function GET(_request, context) {
  const { id } = await context.params;
  const pending = await readPendingShareBytes(id);
  if (!pending) {
    return NextResponse.json({ ok: false, error: MISSING_ERROR }, { status: 404 });
  }

  return new NextResponse(pending.bytes, {
    headers: {
      "content-type": pending.metadata.content_type || "application/octet-stream",
      "content-length": String(pending.metadata.size || pending.bytes.length),
      "x-file-name-url": encodeURIComponent(pending.metadata.filename || "shared-file"),
      "cache-control": "no-store",
    },
  });
}
