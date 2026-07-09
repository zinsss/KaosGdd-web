"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { dispatchAppStatusChanged } from "../lib/app-status-events";

export default function FaxInboxActions({
  faxId,
  canSave = false,
  savedFileId = null,
  compact = false,
  showOpenDownload = false,
  pdfAvailable = false,
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");

  async function saveToFiles() {
    setBusyAction("save");
    setError("");
    try {
      const res = await fetch(`/api/fax/${faxId}/save-to-files`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Save to Files failed");
        return;
      }
      dispatchAppStatusChanged({ source: "fax", action: "save-to-files", faxId, fileId: data.file_id || data.id });
      router.refresh();
    } catch {
      setError("Save to Files failed");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteFax() {
    if (!window.confirm("Delete this fax inbox item?")) return;
    setBusyAction("delete");
    setError("");
    try {
      const res = await fetch(`/api/fax/${faxId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Delete failed");
        return;
      }
      dispatchAppStatusChanged({ source: "fax", action: "delete", faxId });
      router.push("/fax");
      router.refresh();
    } catch {
      setError("Delete failed");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className={compact ? "faxInboxActions faxInboxActionsCompact" : "faxInboxActions"}>
      {showOpenDownload && pdfAvailable ? (
        <>
          <a className="button buttonToneNeutral" href={`/api/fax/${faxId}/open`}>Open</a>
          <a className="button buttonToneCopy" href={`/api/fax/${faxId}/open?download=1`}>Download</a>
        </>
      ) : null}
      {canSave ? (
        <button className="button buttonToneCopy" type="button" onClick={saveToFiles} disabled={Boolean(busyAction)}>
          {busyAction === "save" ? "Saving..." : "Save to Files"}
        </button>
      ) : savedFileId ? (
        <a className="button buttonToneNeutral" href={`/files/${savedFileId}`}>Open File</a>
      ) : null}
      <button className="button buttonToneDanger" type="button" onClick={deleteFax} disabled={Boolean(busyAction)}>
        {busyAction === "delete" ? "Deleting..." : "Delete"}
      </button>
      {error ? <span className="errorText">{error}</span> : null}
    </div>
  );
}
