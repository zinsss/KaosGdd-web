"use client";

import { useEffect } from "react";

import { setBadgeCount } from "../../lib/pwa/badge";

async function refreshAttentionBadge() {
  const [activeRes, firedRes] = await Promise.all([
    fetch("/api/reminders?mode=active", { cache: "no-store" }),
    fetch("/api/reminders?mode=fired", { cache: "no-store" }),
  ]);

  const activeData = await activeRes.json().catch(() => ({ items: [] }));
  const firedData = await firedRes.json().catch(() => ({ items: [] }));

  const missedCount = (activeData.items || []).filter((item) => item.state === "missed").length;
  const firedCount = (firedData.items || []).filter((item) => item.state === "fired").length;
  const attentionCount = missedCount + firedCount;

  await setBadgeCount(attentionCount);
}

export default function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    refreshAttentionBadge().catch(() => undefined);
  }, []);

  return null;
}
