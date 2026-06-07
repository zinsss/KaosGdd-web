import Link from "next/link";

import FaxInboxActions from "../../components/FaxInboxActions";

async function getFaxes() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/fax", { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

function badgeLabel(item) {
  return item.direction === "incoming" ? "Incoming" : "Outgoing";
}

function canSaveToFiles(item) {
  return item.direction === "incoming" && item.fax_status === "received" && !item.saved_file_id;
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
          <ul className="taskList">
            {items.map((item) => (
              <li key={item.id} className="taskListRow">
                <div className="eventListTitleRow">
                  <span className="eventSystemBadge eventObservanceBadge">{badgeLabel(item)}</span>
                  <Link href={`/fax/${item.id}`} className="taskLink taskListTitleLink">
                    {item.title || "Fax"}
                  </Link>
                </div>
                <div className="metaLine">
                  {item.fax_status}
                  {item.remote_number ? ` • ${item.remote_number}` : ""}
                  {item.saved_file_id ? " • saved to Files" : ""}
                  {" • "}
                  {item.received_at_display || item.sent_at_display || item.created_at_display || item.created_at}
                </div>
                <FaxInboxActions
                  faxId={item.id}
                  canSave={canSaveToFiles(item)}
                  savedFileId={item.saved_file_id}
                  compact
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
