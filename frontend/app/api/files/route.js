import { NextResponse } from "next/server";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
}

export async function GET(request) {
  const base = getApiBase();
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const res = await fetch(base + "/files" + (query ? `?${query}` : ""), { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request) {
  const base = getApiBase();
  const uploadTarget = `${base}/files`;
  const fileName = request.headers.get("x-file-name") || "uploaded-file";
  const fileType = request.headers.get("x-file-type") || "application/octet-stream";
  const contentLength = request.headers.get("content-length") || "unknown";

  console.info("[api/files] upload request received", {
    fileName,
    fileType,
    contentLength,
    uploadTarget,
  });

  const headers = {
    "content-type": request.headers.get("content-type") || "application/octet-stream",
    "x-file-name": fileName,
    "x-file-type": fileType,
  };

  if (request.headers.get("content-length")) {
    headers["content-length"] = request.headers.get("content-length");
  }

  let res;
  try {
    res = await fetch(uploadTarget, {
      method: "POST",
      body: request.body,
      headers,
      cache: "no-store",
      duplex: "half",
    });
  } catch (error) {
    console.error("[api/files] upload forwarding failed", {
      uploadTarget,
      contentLength,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "File upload request failed." },
      { status: 502 },
    );
  }

  const rawText = await res.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    console.error("[api/files] backend upload failed", {
      uploadTarget,
      status: res.status,
      contentLength,
      bodyPreview: rawText.slice(0, 300),
    });
  }

  return NextResponse.json(data || { ok: false, error: "File upload failed." }, { status: res.status });
}
