import JournalDetailPanel from "../../../components/JournalDetailPanel";
import { getApiBase } from "../../../lib/api-base";
import { UI_STRINGS } from "../../../lib/strings";

async function getJournal(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/journals/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

export default async function JournalDetailPage({ params }) {
  const { id } = await params;
  const result = await getJournal(id);

  return (
    <main className="page">
      {!result.ok ? (
        <section className="panel">
          <div className="errorText">{result.error || UI_STRINGS.JOURNAL_NOT_FOUND}</div>
        </section>
      ) : (
        <JournalDetailPanel item={result.item} />
      )}
    </main>
  );
}
