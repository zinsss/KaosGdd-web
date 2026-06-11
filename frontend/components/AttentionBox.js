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

function buildAttentionSignature(tasks, reminders, faxes) {
  const parts = [
    ...tasks.map((item) => `t:${item.id}:${item.state || ""}:${item.when || ""}`),
    ...reminders.map((item) => `r:${item.id}:${item.state || ""}:${item.when || ""}`),
    ...faxes.map((item) => `f:${item.id}:${item.direction || ""}:${item.fax_status || ""}:${item.when || ""}`),
  ];

  return parts.sort().join("|");
}

function getItemCount(payload, key, items) {
  const count = Number(payload?.[key]);
  return Number.isFinite(count) ? Math.max(0, count) : items.length;
}

function getTotalCount(payload, tasks, reminders, faxes) {
  const counts = {
    tasks: getItemCount(payload, "attention_task_count", tasks),
    reminders: getItemCount(payload, "attention_reminder_count", reminders),
    faxes: getItemCount(payload, "attention_fax_count", faxes),
  };
  const payloadStrongAttentionCount = Number(payload?.strong_attention_count);
  const strong = Number.isFinite(payloadStrongAttentionCount)
    ? Math.max(0, payloadStrongAttentionCount)
    : counts.tasks + counts.reminders + counts.faxes;

  return { ...counts, strong };
}

function formatCount(label, count) {
  if (!count) return null;
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatCountLine(counts) {
  return [formatCount("task", counts.tasks), formatCount("reminder", counts.reminders), formatCount("fax", counts.faxes)]
    .filter(Boolean)
    .join(" / ");
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
  const [attention, setAttention] = useState({
    tasks: [],
    reminders: [],
    faxes: [],
    counts: { tasks: 0, reminders: 0, faxes: 0, strong: 0 },
  });
  const [dismissedSignature, setDismissedSignature] = useState("");

  const loadAttention = useCallback(async () => {
    try {
      const res = await fetch("/api/nav-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const tasks = normalizeItems(data?.attention_tasks);
      const reminders = normalizeItems(data?.attention_reminders);
      const faxes = normalizeItems(data?.attention_faxes);

      setAttention({
        tasks,
        reminders,
        faxes,
        counts: getTotalCount(data, tasks, reminders, faxes),
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
    () => buildAttentionSignature(attention.tasks, attention.reminders, attention.faxes),
    [attention.tasks, attention.reminders, attention.faxes],
  );

  const visibleItems = [...attention.tasks, ...attention.reminders, ...attention.faxes];
  const hiddenCount = Math.max(0, attention.counts.strong - visibleItems.length);
  const moreHref = attention.counts.tasks > attention.tasks.length
    ? "/tasks"
    : attention.counts.reminders > attention.reminders.length
      ? "/reminders?mode=fired"
      : "/fax";

  if (attention.counts.strong <= 0 || !signature || dismissedSignature === signature) {
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
          <span className="attentionBoxCounts">{formatCountLine(attention.counts)}</span>
        </div>
        <button className="attentionBoxClose" type="button" onClick={dismiss} aria-label="Close attention box">
          Close
        </button>
      </div>

      <div className="attentionBoxList">
        {attention.tasks.map((item) => (
          <Link className="attentionBoxItem" href={item.href || "/tasks"} key={`task-${item.id}`}>
            <AttentionPill tone="Task">overdue</AttentionPill>
            <span className="attentionBoxItemTitle">{item.title || "Task"}</span>
            {item.when ? <span className="attentionBoxItemMeta">{item.when}</span> : null}
          </Link>
        ))}

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
