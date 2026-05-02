export async function GET(request, { params }) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const source = await fetch(base + "/files/" + params.id + "/open", { cache: "no-store" });

  const contentType = source.headers.get("content-type") || "application/octet-stream";
  const sourceDisposition = source.headers.get("content-disposition") || "";
  const isDownload = request.nextUrl.searchParams.get("download") === "1";

  let contentDisposition = "inline";
  if (isDownload) {
    contentDisposition = sourceDisposition && sourceDisposition !== "inline" ? sourceDisposition : "attachment";
  }

  return new Response(source.body, {
    status: source.status,
    headers: {
      "content-type": contentType,
      "content-disposition": contentDisposition,
      "cache-control": "no-store",
    },
  });
}
