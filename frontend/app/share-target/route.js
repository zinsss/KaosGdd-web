import { NextResponse } from "next/server.js";

import { createPendingShareFromFile } from "../../lib/pending-share-store.js";

function isUploadedFile(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.name === "string"
  );
}

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "shared file upload must use multipart/form-data" }, { status: 400 });
  }

  const files = formData.getAll("file").filter(isUploadedFile);
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "one shared file is required" }, { status: 400 });
  }
  if (files.length > 1) {
    return NextResponse.json({ ok: false, error: "only one shared file is supported" }, { status: 400 });
  }

  const pending = await createPendingShareFromFile(files[0]);
  const redirectTo = `/?shared_file=${encodeURIComponent(pending.id)}`;
  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
