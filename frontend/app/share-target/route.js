import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

async function uploadSharedFile(file) {
  const bytes = await file.arrayBuffer();
  const res = await fetch(`${API_BASE}/files`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-file-name": file.name || "shared-file",
      "x-file-type": file.type || "",
    },
    body: bytes,
    cache: "no-store",
  });

  return res.ok;
}

export async function POST(request) {
  const formData = await request.formData();
  const sharedTitle = String(formData.get("title") || "").trim();
  const sharedText = String(formData.get("text") || "").trim();
  const sharedUrl = String(formData.get("url") || "").trim();

  const files = formData
    .getAll("files")
    .filter((value) => value instanceof File && value.size > 0);

  let uploadedCount = 0;
  for (const file of files) {
    const ok = await uploadSharedFile(file);
    if (ok) uploadedCount += 1;
  }

  const params = new URLSearchParams();
  if (sharedTitle && !sharedText) params.set("text", sharedTitle);
  if (sharedText) params.set("text", sharedText);
  if (sharedUrl) params.set("url", sharedUrl);
  if (uploadedCount > 0) params.set("sharedFiles", String(uploadedCount));

  const redirectTo = `/share-intake${params.toString() ? `?${params.toString()}` : ""}`;
  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
