import { NextResponse } from "next/server.js";

import { deletePendingShare, readPendingShareMetadata } from "../../../../lib/pending-share-store.js";

const MISSING_ERROR = "shared file expired or missing";

export async function GET(_request, { params }) {
  const metadata = await readPendingShareMetadata(params.id);
  if (!metadata) {
    return NextResponse.json({ ok: false, error: MISSING_ERROR }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: metadata });
}

export async function DELETE(_request, { params }) {
  await deletePendingShare(params.id);
  return NextResponse.json({ ok: true });
}
