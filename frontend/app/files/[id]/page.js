import FileDetailPanel from "../../../components/FileDetailPanel";

async function getFile(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/files/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: "backend unreachable" };
  }
}

async function getFileRaw(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/files/" + id + "/raw", { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, raw: "" };
  }
}

export default async function FileDetailPage({ params }) {
  const result = await getFile(params.id);
  const rawResult = result.ok ? await getFileRaw(params.id) : { ok: false, raw: "" };

  return (
    <main className="page">
      {!result.ok ? (
        <section className="panel"><div className="errorText">{result.error || "File not found."}</div></section>
      ) : (
        <FileDetailPanel item={result.item} raw={rawResult.raw || ""} />
      )}
    </main>
  );
}
