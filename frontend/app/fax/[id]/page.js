import Link from "next/link";

async function getFax(id) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/fax/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: "backend unreachable" };
  }
}

export default async function FaxDetailPage({ params }) {
  const { id } = await params;
  const result = await getFax(id);
  const item = result.item;

  return (
    <main className="page">
      <div className="detailBackLinkRow"><Link className="taskLink backLink" href="/fax">&lt; Back to Fax</Link></div>
      {!result.ok || !item ? (
        <section className="panel"><div className="errorText">{result.error || "not found"}</div></section>
      ) : (
        <section className="panel">
          <div className="detailPageLabel">• Fax Detail</div>
          <div className="detailTitleRow">
            <div className="sectionTitle detailMainTitle">{item.title || "Fax"}</div>
            <div className="detailStateText">{item.fax_status}</div>
          </div>
          <div className="detailReadBlock">
            <div className="detailReadRow"><div className="detailReadLabel">Direction</div><div className="detailReadContent withDivider">{item.direction}</div></div>
            {item.remote_number ? <div className="detailReadRow"><div className="detailReadLabel">Remote</div><div className="detailReadContent withDivider">{item.remote_number}</div></div> : null}
            {item.local_device ? <div className="detailReadRow"><div className="detailReadLabel">Device</div><div className="detailReadContent withDivider">{item.local_device}</div></div> : null}
            <div className="detailReadRow"><div className="detailReadLabel">Created</div><div className="detailReadContent withDivider">{item.created_at_display || item.created_at}</div></div>
            {item.received_at_display ? <div className="detailReadRow"><div className="detailReadLabel">Received</div><div className="detailReadContent withDivider">{item.received_at_display}</div></div> : null}
            {item.sent_at_display ? <div className="detailReadRow"><div className="detailReadLabel">Sent</div><div className="detailReadContent withDivider">{item.sent_at_display}</div></div> : null}
            {item.error_message ? <div className="detailReadRow"><div className="detailReadLabel">Error</div><div className="detailReadContent withDivider errorText">{item.error_message}</div></div> : null}
            <div className="detailReadRow">
              <div className="detailReadLabel">PDF</div>
              <div className="detailReadContent withDivider">
                {item.pdf_available ? (
                  <div className="actionRow" style={{ gap: 8, flexWrap: "wrap" }}>
                    <a className="button buttonToneNeutral" href={`/api/fax/${item.id}/open`}>Open</a>
                    <a className="button buttonToneCopy" href={`/api/fax/${item.id}/open?download=1`}>Download</a>
                  </div>
                ) : (
                  <span className="metaLine">No PDF available.</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
