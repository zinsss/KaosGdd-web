import NoteDetailPanel from "../../../components/NoteDetailPanel";
import { getApiBase } from "../../../lib/api-base";
import { UI_STRINGS } from "../../../lib/strings";

async function getNote(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/notes/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

async function getNoteRaw(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/notes/" + id + "/raw", { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, raw: "" };
  }
}

export default async function NoteDetailPage({ params }) {
  const result = await getNote(params.id);
  const rawResult = result.ok ? await getNoteRaw(params.id) : { ok: false, raw: "" };

  return (
    <main className="page">
      {!result.ok ? (
        <section className="panel"><div className="errorText">{result.error || UI_STRINGS.NOTE_NOT_FOUND}</div></section>
      ) : (
        <NoteDetailPanel item={result.item} raw={rawResult.raw || ""} />
      )}
    </main>
  );
}
