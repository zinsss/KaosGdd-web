"use client";

import { useEffect } from "react";

import { setBadgeCount } from "../../lib/pwa/badge";
import { hasAppAttention } from "../../lib/module-nav-status";
import { bootstrapPushSubscription } from "../../lib/pwa/push";

async function refreshAttentionBadge() {
  const navStatusRes = await fetch("/api/nav-status", { cache: "no-store" });
  const navStatusData = await navStatusRes.json().catch(() => ({}));
  await setBadgeCount(hasAppAttention(navStatusData) ? 1 : 0);
}

export default function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    refreshAttentionBadge().catch(() => undefined);
    bootstrapPushSubscription().catch(() => undefined);
  }, []);

  return null;
}
