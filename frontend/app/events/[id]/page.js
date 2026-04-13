import EventDetailPanel from "../../../components/EventDetailPanel";

async function getEvent(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/events/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: "backend unreachable" };
  }
}

async function getEventRaw(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
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
        <section className="panel"><div className="errorText">{result.error || "Event not found."}</div></section>
      ) : (
        <EventDetailPanel item={result.item} raw={rawResult.raw || ""} />
      )}
    </main>
  );
}
