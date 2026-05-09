import { UI_STRINGS } from "../../lib/strings";
import { getApiBase } from "../../lib/api-base";
import PushControls from "../../components/pwa/PushControls";

async function getHealth() {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    return await res.json();
  } catch {
    return { ok: false, app: UI_STRINGS.BACKEND_UNREACHABLE };
  }
}

export default async function SettingsPage() {
  const health = await getHealth();

  return (
    <main className="page">
      <section className="panel">
        <div className="line">{UI_STRINGS.SETTINGS}</div>
        <div className="subline">System diagnostics and notification checks.</div>
      </section>

      <section className="panel">
        <div className="sectionTitle">{UI_STRINGS.SYSTEM}</div>
        <div className="row">
          <span>{UI_STRINGS.BACKEND}</span>
          <span>{health.ok ? UI_STRINGS.STATUS_OK : UI_STRINGS.STATUS_DOWN}</span>
        </div>
        <div className="row">
          <span>{UI_STRINGS.APP}</span>
          <span>{health.app}</span>
        </div>
      </section>

      <PushControls />
    </main>
  );
}
