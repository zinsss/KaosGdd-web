import FileDetailPanel from "../../../components/FileDetailPanel";
import { getApiBase } from "../../../lib/api-base";
import { UI_STRINGS } from "../../../lib/strings";

async function getFile(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/files/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

async function getFileRaw(id) {
  const base = getApiBase();
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
        <section className="panel"><div className="errorText">{result.error || UI_STRINGS.FILE_NOT_FOUND}</div></section>
      ) : (
        <FileDetailPanel item={result.item} raw={rawResult.raw || ""} />
      )}
    </main>
  );
}
