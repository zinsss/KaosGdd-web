"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { KAOSGDD_STATUS_CHANGED_EVENT } from "../lib/app-status-events";

const DISMISSED_SIGNATURE_KEY = "kaosgdd:attention-box-dismissed-signature";
const ATTENTION_REFRESH_MS = 30000;

function normalizeItems(items) {
  return Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : [];
}

function buildAttentionSignature(reminders, faxes) {
  const parts = [
    ...reminders.map((item) => `r:${item.id}:${item.state || ""}:${item.when || ""}`),
    ...faxes.map((item) => `f:${item.id}:${item.direction || ""}:${item.fax_status || ""}:${item.when || ""}`),
  ];

  return parts.sort().join("|");
}

function getTotalCount(payload, reminders, faxes) {
  const reminderCount = Number(payload?.attention_reminder_count);
  const faxCount = Number(payload?.attention_fax_count);

  return {
    reminders: Number.isFinite(reminderCount) ? Math.max(0, reminderCount) : reminders.length,
    faxes: Number.isFinite(faxCount) ? Math.max(0, faxCount) : faxes.length,
  };
}

function getReminderStateLabel(state) {
  return state === "missed" ? "missed" : "fired";
}

function getFaxStateLabel(item) {
  if (item.direction === "incoming") return "received";
  if (item.fax_status === "conversion_failed") return "conversion error";
  return "send error";
}

function AttentionPill({ tone, children }) {
  return <span className={`attentionBoxPill attentionBoxPill${tone}`}>{children}</span>;
}

export default function AttentionBox() {
  const pathname = usePathname();
  const [attention, setAttention] = useState({ reminders: [], faxes: [], counts: { reminders: 0, faxes: 0 } });
  const [dismissedSignature, setDismissedSignature] = useState("");

  const loadAttention = useCallback(async () => {
    try {
      const res = await fetch("/api/nav-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const reminders = normalizeItems(data?.attention_reminders);
      const faxes = normalizeItems(data?.attention_faxes);

      setAttention({
        reminders,
        faxes,
        counts: getTotalCount(data, reminders, faxes),
      });
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    try {
      setDismissedSignature(window.localStorage.getItem(DISMISSED_SIGNATURE_KEY) || "");
    } catch {
      setDismissedSignature("");
    }
  }, []);

  useEffect(() => {
    loadAttention();
  }, [loadAttention, pathname]);

  useEffect(() => {
    function refreshAttention() {
      loadAttention();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadAttention();
      }
    }

    const intervalId = window.setInterval(loadAttention, ATTENTION_REFRESH_MS);

    window.addEventListener("kaosgdd:capture-created", refreshAttention);
    window.addEventListener(KAOSGDD_STATUS_CHANGED_EVENT, refreshAttention);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("kaosgdd:capture-created", refreshAttention);
      window.removeEventListener(KAOSGDD_STATUS_CHANGED_EVENT, refreshAttention);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadAttention]);

  const signature = useMemo(
    () => buildAttentionSignature(attention.reminders, attention.faxes),
    [attention.reminders, attention.faxes],
  );

  const totalCount = attention.counts.reminders + attention.counts.faxes;
  const visibleItems = [...attention.reminders, ...attention.faxes];
  const hiddenCount = Math.max(0, totalCount - visibleItems.length);
  const moreHref = attention.counts.reminders > attention.reminders.length ? "/reminders?mode=fired" : "/fax";

  if (!signature || totalCount <= 0 || dismissedSignature === signature) {
    return null;
  }

  function dismiss() {
    setDismissedSignature(signature);
    try {
      window.localStorage.setItem(DISMISSED_SIGNATURE_KEY, signature);
    } catch {
      return;
    }
  }

  return (
    <section className="attentionBox" aria-label="Needs attention">
      <div className="attentionBoxTopLine">
        <div className="attentionBoxTitle">
          <span>Needs attention</span>
          <span className="attentionBoxCounts">
            {attention.counts.reminders ? `${attention.counts.reminders} reminder${attention.counts.reminders === 1 ? "" : "s"}` : null}
            {attention.counts.reminders && attention.counts.faxes ? " / " : null}
            {attention.counts.faxes ? `${attention.counts.faxes} fax${attention.counts.faxes === 1 ? "" : "es"}` : null}
          </span>
        </div>
        <button className="attentionBoxClose" type="button" onClick={dismiss} aria-label="Close attention box">
          Close
        </button>
      </div>

      <div className="attentionBoxList">
        {attention.reminders.map((item) => (
          <Link className="attentionBoxItem" href={item.href || "/reminders?mode=fired"} key={`reminder-${item.id}`}>
            <AttentionPill tone="Reminder">{getReminderStateLabel(item.state)}</AttentionPill>
            <span className="attentionBoxItemTitle">{item.title || "Reminder"}</span>
            {item.when ? <span className="attentionBoxItemMeta">{item.when}</span> : null}
          </Link>
        ))}

        {attention.faxes.map((item) => (
          <Link className="attentionBoxItem" href={item.href || "/fax"} key={`fax-${item.id}`}>
            <AttentionPill tone="Fax">{getFaxStateLabel(item)}</AttentionPill>
            <span className="attentionBoxItemTitle">{item.title || "Fax"}</span>
            {item.when ? <span className="attentionBoxItemMeta">{item.when}</span> : null}
            {item.error_message ? <span className="attentionBoxItemMeta attentionBoxError">{item.error_message}</span> : null}
          </Link>
        ))}

        {hiddenCount ? (
          <Link className="attentionBoxItem attentionBoxMore" href={moreHref}>
            <span className="attentionBoxItemTitle">+{hiddenCount} more</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
