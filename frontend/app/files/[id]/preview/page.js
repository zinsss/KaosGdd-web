import Link from "next/link";
import { getApiBase } from "../../../../lib/api-base";
import { UI_STRINGS } from "../../../../lib/strings";

async function getFile(id) {
  const base = getApiBase();
  try {
    const res = await fetch(base + "/files/" + id, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, error: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

export default async function FilePreviewPage({ params }) {
  const result = await getFile(params.id);

  if (!result.ok) {
    return (
      <main className="page">
        <section className="panel"><div className="errorText">{result.error || UI_STRINGS.FILE_NOT_FOUND}</div></section>
      </main>
    );
  }

  const file = result.item;
  const title = file.title || file.original_filename || "File";
  const isPdf = String(file.mime_type || "").toLowerCase().includes("pdf");

  return (
    <main className="page">
      <section className="panel">
        <div className="detailTitleRow" style={{ alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Link className="taskLink backLink" href={`/files/${file.id}`}>&lt; Back</Link>
          <div className="sectionTitle detailMainTitle" style={{ margin: 0, flex: 1 }}>{title}</div>
          <div className="actionRow" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="button" href={`/api/files/${file.id}/open`} target="_blank" rel="noreferrer">Open externally</a>
            <a className="button" href={`/api/files/${file.id}/preview?download=1`}>Download</a>
          </div>
        </div>

        {isPdf ? (
          <iframe
            title={title}
            src={`/api/files/${file.id}/preview`}
            style={{ width: "100%", minHeight: "70vh", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }}
          />
        ) : (
          <div className="detailReadBlock">
            <div className="detailReadRow">
              <div className="detailReadContent withDivider">
                Inline preview is not available for this file type.
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
