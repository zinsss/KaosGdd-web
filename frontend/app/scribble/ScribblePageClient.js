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

function previewFromBody(body) {
  return String(body || "").trim();
}

export default function ScribblePageClient() {
  const [cards, setCards] = useState([]);
  const [expandedId, setExpandedId] = useState("");
  const [status, setStatus] = useState("loading");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const saveTimeoutRef = useRef(0);
  const lastSavedBodiesRef = useRef({});

  useEffect(() => {
    let isMounted = true;

    async function loadScribbles() {
      setStatus("loading");
      try {
        const res = await fetch("/api/scribbles", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!isMounted) return;
        if (!res.ok || !data?.ok) {
          setStatus("error");
          return;
        }
        const nextCards = Array.isArray(data.items) ? data.items : [];
        lastSavedBodiesRef.current = Object.fromEntries(nextCards.map((card) => [card.id, card.body || ""]));
        setCards(nextCards);
        setStatus("saved");
      } catch {
        if (!isMounted) return;
        setStatus("error");
      }
    }

    loadScribbles();
    return () => {
      isMounted = false;
      window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const expandedCard = useMemo(
    () => cards.find((card) => card.id === expandedId) || null,
    [cards, expandedId],
  );

  useEffect(() => {
    if (!expandedCard) return undefined;
    const savedBody = lastSavedBodiesRef.current[expandedCard.id] ?? "";
    if ((expandedCard.body || "") === savedBody) {
      if (status !== "loading" && status !== "error") setStatus("saved");
      return undefined;
    }

    setStatus("saving");
    window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      const bodyToSave = expandedCard.body || "";
      try {
        const res = await fetch(`/api/scribbles/${expandedCard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: bodyToSave }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setStatus("error");
          return;
        }
        lastSavedBodiesRef.current = {
          ...lastSavedBodiesRef.current,
          [expandedCard.id]: bodyToSave,
        };
        setCards((current) => current.map((card) => (card.id === expandedCard.id ? { ...card, ...(data.item || {}) } : card)));
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(saveTimeoutRef.current);
  }, [expandedCard?.id, expandedCard?.body]);

  const statusText = useMemo(() => {
    if (status === "loading") return "loading…";
    if (status === "saving") return "saving";
    if (status === "error") return "save failed";
    return "saved";
  }, [status]);

  function updateCardBody(cardId, body) {
    setActionMessage("");
    setActionError("");
    setCards((current) => current.map((card) => (card.id === cardId ? { ...card, body } : card)));
  }

  async function sendToCapture(card) {
    const raw = String(card?.body || "").trim();
    setActionMessage("");
    setActionError("");
    if (!raw) {
      setActionError("Scribble card is empty.");
      return;
    }

    setBusyAction(`capture:${card.id}`);
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
      setActionMessage("Sent to Capture. Scribble card was kept for now.");
    } catch {
      setActionError("Capture failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function createNote(card) {
    const cleanBody = String(card?.body || "").trim();
    setActionMessage("");
    setActionError("");
    if (!cleanBody) {
      setActionError("Scribble card is empty.");
      return;
    }

    setBusyAction(`note:${card.id}`);
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
      setActionMessage("Created Note. Scribble card was kept for now.");
    } catch {
      setActionError("Note creation failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteCard(card) {
    setActionMessage("");
    setActionError("");
    const confirmed = window.confirm("Delete this Scribble card?");
    if (!confirmed) return;

    setBusyAction(`delete:${card.id}`);
    try {
      const res = await fetch(`/api/scribbles/${card.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setActionError((data && data.error) || "Delete failed.");
        return;
      }
      lastSavedBodiesRef.current = Object.fromEntries(
        Object.entries(lastSavedBodiesRef.current).filter(([id]) => id !== card.id),
      );
      setCards((current) => current.filter((item) => item.id !== card.id));
      setExpandedId((current) => (current === card.id ? "" : current));
      setActionMessage("Deleted Scribble card.");
    } catch {
      setActionError("Delete failed.");
    } finally {
      setBusyAction("");
    }
  }

  const isLoading = status === "loading";

  return (
    <main className="page scribblePage">
      <section className="panel scribblePanel">
        <div className="scribbleHeader">
          <div>
            <div className="sectionTitle">Scribble</div>
            <div className="scribbleDescription">Transient scratch cards for messy capture before it becomes a task, event, journal entry, note, file, or disappears.</div>
          </div>
          <div className={`scribbleStatus scribbleStatus_${status}`} aria-live="polite">{statusText}</div>
        </div>

        {isLoading ? <div className="metaLine">Loading Scribble cards…</div> : null}
        {!isLoading && cards.length === 0 ? (
          <div className="emptyState">Unknown capture text sent to Scribble appears here as temporary workspace cards until you classify or delete it.</div>
        ) : null}

        <div className="scribbleCardGrid" aria-label="Scribble cards">
          {cards.map((card) => {
            const isExpanded = expandedId === card.id;
            const preview = previewFromBody(card.body) || "Empty Scribble card";
            const cardBusy = busyAction.endsWith(`:${card.id}`);
            return (
              <article key={card.id} className={`scribbleCard${isExpanded ? " scribbleCard_expanded" : ""}`}>
                <button
                  className="scribbleCardSummary"
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? "" : card.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="scribbleCardLabel">Scribble</span>
                  <span className="scribbleCardPreview">{preview}</span>
                </button>

                {isExpanded ? (
                  <div className="scribbleCardDetail">
                    <textarea
                      className="textInput scribbleCardTextarea"
                      value={card.body || ""}
                      onChange={(event) => updateCardBody(card.id, event.target.value)}
                      aria-label="Scribble card text"
                      spellCheck="true"
                    />
                    <div className="scribbleActionRow">
                      <button className="button" type="button" onClick={() => sendToCapture(card)} disabled={cardBusy || !(card.body || "").trim()}>
                        {busyAction === `capture:${card.id}` ? "Sending…" : "Capture"}
                      </button>
                      <button className="button" type="button" onClick={() => createNote(card)} disabled={cardBusy || !(card.body || "").trim()}>
                        {busyAction === `note:${card.id}` ? "Creating…" : "Note"}
                      </button>
                      <button className="button" type="button" onClick={() => deleteCard(card)} disabled={cardBusy}>
                        {busyAction === `delete:${card.id}` ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {actionMessage ? <div className="successText">{actionMessage}</div> : null}
        {actionError ? <div className="errorText">{actionError}</div> : null}
      </section>
    </main>
  );
}
