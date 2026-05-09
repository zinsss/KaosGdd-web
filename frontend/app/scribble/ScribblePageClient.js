"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SAVE_DELAY_MS = 700;

function noteTitleFromBody(body) {
  const firstLine = String(body || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return "Scribble note";
  return firstLine.slice(0, 80);
}

function noteRawFromBody(body) {
  return [":::", `title: ${noteTitleFromBody(body)}`, "tags:", "link:", ":::", "", String(body || "").trimEnd()].join("\n");
}

export default function ScribblePageClient() {
  const [body, setBody] = useState("");
  const [lastSavedBody, setLastSavedBody] = useState("");
  const [status, setStatus] = useState("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [isSendingCapture, setIsSendingCapture] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const didLoadRef = useRef(false);
  const saveTimeoutRef = useRef(0);
  const latestBodyRef = useRef("");

  useEffect(() => {
    latestBodyRef.current = body;
  }, [body]);

  useEffect(() => {
    let isMounted = true;

    async function loadScribble() {
      setStatus("loading");
      try {
        const res = await fetch("/api/scribble", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!isMounted) return;
        if (!res.ok || !data?.ok) {
          setStatus("error");
          return;
        }
        const nextBody = data.item?.body || "";
        setBody(nextBody);
        setLastSavedBody(nextBody);
        setStatus("saved");
        didLoadRef.current = true;
      } catch {
        if (!isMounted) return;
        setStatus("error");
      }
    }

    loadScribble();
    return () => {
      isMounted = false;
      window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!didLoadRef.current) return undefined;
    if (body === lastSavedBody) {
      setStatus("saved");
      return undefined;
    }

    setStatus("saving");
    window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      const bodyToSave = latestBodyRef.current;
      try {
        const res = await fetch("/api/scribble", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: bodyToSave }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setStatus("error");
          return;
        }
        setLastSavedBody(bodyToSave);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(saveTimeoutRef.current);
  }, [body, lastSavedBody]);

  const statusText = useMemo(() => {
    if (status === "loading") return "loading…";
    if (status === "saving") return "saving";
    if (status === "error") return "save failed";
    return "saved";
  }, [status]);

  async function sendToCapture() {
    const raw = body.trim();
    setActionMessage("");
    setActionError("");
    if (!raw) {
      setActionError("Scribble is empty.");
      return;
    }

    setIsSendingCapture(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setActionError((data && data.error) || "Capture failed.");
        return;
      }
      setActionMessage("Sent to Capture. Scribble was kept.");
    } catch {
      setActionError("Capture failed.");
    } finally {
      setIsSendingCapture(false);
    }
  }

  async function createNote() {
    const cleanBody = body.trim();
    setActionMessage("");
    setActionError("");
    if (!cleanBody) {
      setActionError("Scribble is empty.");
      return;
    }

    setIsCreatingNote(true);
    try {
      const res = await fetch("/api/notes/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: noteRawFromBody(cleanBody) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setActionError((data && data.error) || "Note creation failed.");
        return;
      }
      setActionMessage("Created Note. Scribble was kept.");
    } catch {
      setActionError("Note creation failed.");
    } finally {
      setIsCreatingNote(false);
    }
  }

  async function clearScribble() {
    setActionMessage("");
    setActionError("");
    if (!body) return;
    const confirmed = window.confirm("Clear Scribble? This removes the current temporary text.");
    if (!confirmed) return;
    window.clearTimeout(saveTimeoutRef.current);
    setBody("");
    setStatus("saving");
    try {
      const res = await fetch("/api/scribble", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setStatus("error");
        setActionError("Clear failed.");
        return;
      }
      setLastSavedBody("");
      setStatus("saved");
      setActionMessage("Scribble cleared.");
    } catch {
      setStatus("error");
      setActionError("Clear failed.");
    }
  }

  const actionsDisabled = status === "loading" || isSendingCapture || isCreatingNote;

  return (
    <main className="page scribblePage">
      <section className="panel scribblePanel">
        <div className="scribbleHeader">
          <div>
            <div className="sectionTitle">Scribble</div>
            <div className="scribbleDescription">Temporary messy text before it becomes a task, journal entry, or note.</div>
          </div>
          <div className={`scribbleStatus scribbleStatus_${status}`} aria-live="polite">{statusText}</div>
        </div>

        <textarea
          className="textInput scribbleTextarea"
          value={body}
          onChange={(event) => {
            setActionMessage("");
            setActionError("");
            setBody(event.target.value);
          }}
          placeholder="Write messy text here…"
          aria-label="Scribble text"
          spellCheck="true"
        />

        <div className="scribbleActionRow">
          <button className="button" type="button" onClick={sendToCapture} disabled={actionsDisabled || !body.trim()}>
            {isSendingCapture ? "Sending…" : "Send to Capture"}
          </button>
          <button className="button" type="button" onClick={createNote} disabled={actionsDisabled || !body.trim()}>
            {isCreatingNote ? "Creating…" : "Create Note"}
          </button>
          <button className="button" type="button" onClick={clearScribble} disabled={actionsDisabled || !body}>
            Clear
          </button>
        </div>

        {actionMessage ? <div className="successText">{actionMessage}</div> : null}
        {actionError ? <div className="errorText">{actionError}</div> : null}
      </section>
    </main>
  );
}
