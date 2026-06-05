"use client";

import { useEffect } from "react";

import { updateAppBadge } from "../../lib/app-badge";
import { normalizeModuleNavStatus } from "../../lib/module-nav-status";
import { bootstrapPushSubscription } from "../../lib/pwa/push";

async function refreshAttentionBadge() {
  const navStatusRes = await fetch("/api/nav-status", { cache: "no-store" });
  const navStatusData = await navStatusRes.json().catch(() => ({}));
  const navStatus = normalizeModuleNavStatus(navStatusData);
  await updateAppBadge(navStatus.strong_attention_count);
}

export default function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update().catch(() => undefined))
        .catch(() => undefined);
    }

    refreshAttentionBadge().catch(() => undefined);
    bootstrapPushSubscription().catch(() => undefined);
  }, []);

  return null;
}
