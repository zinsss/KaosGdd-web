"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { captureCreatedEventHasType } from "../../lib/post-create-navigation";

const SAVE_DELAY_MS = 700;

function previewFromBody(body) {
  return String(body || "").trim();
}

function scribbleCreatedLabel(card) {
  return card?.created_at_display || card?.created_at || "Unknown datetime";
}

function resizeTextareaToContent(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Copy command failed");
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

    function onCaptureCreated(event) {
      if (captureCreatedEventHasType(event, "scribble")) loadScribbles();
    }

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => {
      isMounted = false;
      window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
      window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const expandedCard = useMemo(
    () => cards.find((card) => card.id === expandedId) || null,
    [cards, expandedId],
  );

  useEffect(() => {
    if (!expandedId) return;
    window.requestAnimationFrame(() => {
      const textarea = document.querySelector(`[data-scribble-textarea-id="${CSS.escape(expandedId)}"]`);
      resizeTextareaToContent(textarea);
    });
  }, [expandedId, expandedCard?.body]);

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

  async function copyCardBody(card) {
    const body = String(card?.body || "");
    setActionMessage("");
    setActionError("");
    if (!body.trim()) {
      setActionError("Scribble card is empty.");
      return;
    }

    setBusyAction(`copy:${card.id}`);
    try {
      await copyTextToClipboard(body);
      setActionMessage("Copied Scribble text.");
    } catch {
      setActionError("Copy failed.");
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
                  <span className="scribbleCardLabel">{scribbleCreatedLabel(card)}</span>
                  <span className="scribbleCardPreview">{preview}</span>
                </button>

                {isExpanded ? (
                  <div className="scribbleCardDetail">
                    <textarea
                      className="textInput scribbleCardTextarea"
                      value={card.body || ""}
                      onChange={(event) => {
                        updateCardBody(card.id, event.target.value);
                        resizeTextareaToContent(event.target);
                      }}
                      ref={resizeTextareaToContent}
                      data-scribble-textarea-id={card.id}
                      rows={1}
                      aria-label="Scribble card text"
                      spellCheck="true"
                    />
                    <div className="scribbleActionRow">
                      <button className="button buttonToneCopy" type="button" onClick={() => copyCardBody(card)} disabled={cardBusy || !(card.body || "").trim()}>
                        {busyAction === `copy:${card.id}` ? "Copying…" : "Copy"}
                      </button>
                      <button className="button buttonToneDanger" type="button" onClick={() => deleteCard(card)} disabled={cardBusy}>
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
