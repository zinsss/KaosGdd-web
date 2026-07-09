import FaxInboxList from "../../components/FaxInboxList";

async function getFaxes() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/fax", { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function FaxPage() {
  const result = await getFaxes();
  const items = Array.isArray(result.items) ? result.items : [];

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitle">Fax</div>
        {items.length === 0 ? (
          <div className="empty">No faxes.</div>
        ) : (
          <FaxInboxList items={items} />
        )}
      </section>
    </main>
  );
}
