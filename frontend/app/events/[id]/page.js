import EventDetailPanel from "../../../components/EventDetailPanel";
import { getApiBase } from "../../../lib/api-base";
import { UI_STRINGS } from "../../../lib/strings";

async function getEvent(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/events/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

async function getEventRaw(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/events/" + id + "/raw", { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, raw: "" };
  }
}

export default async function EventDetailPage({ params }) {
  const result = await getEvent(params.id);
  const rawResult = result.ok ? await getEventRaw(params.id) : { ok: false, raw: "" };

  return (
    <main className="page">
      {!result.ok ? (
        <section className="panel"><div className="errorText">{result.error || UI_STRINGS.EVENT_NOT_FOUND}</div></section>
      ) : (
        <EventDetailPanel item={result.item} raw={rawResult.raw || ""} />
      )}
    </main>
  );
}
