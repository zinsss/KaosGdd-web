export async function GET(request, context) {
  const { id } = await context.params;
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const source = await fetch(base + "/files/" + id + "/open", { cache: "no-store" });

  const contentType = source.headers.get("content-type") || "application/octet-stream";
  const sourceDisposition = source.headers.get("content-disposition") || "";
  const isDownload = request.nextUrl.searchParams.get("download") === "1";

  let contentDisposition = "inline";
  if (isDownload) {
    const filenameMatch = sourceDisposition.match(/;\s*filename\*?=(?:"[^"]*"|[^;]+)/i);
    contentDisposition = filenameMatch ? `attachment${filenameMatch[0]}` : "attachment";
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
