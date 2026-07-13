"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { updateAppBadge } from "../../lib/app-badge";
import { normalizeModuleNavStatus } from "../../lib/module-nav-status";
import { bootstrapPushSubscription } from "../../lib/pwa/push";

async function refreshAttentionBadge() {
  const navStatusRes = await fetch("/api/nav-status", { cache: "no-store" });
  const navStatusData = await navStatusRes.json().catch(() => ({}));
  const navStatus = normalizeModuleNavStatus(navStatusData);
  await updateAppBadge(navStatus.strong_attention_count);
}

function ensureHeadLink(rel, href, attributes = {}) {
  if (typeof document === "undefined") return;
  const selector = attributes.sizes
    ? `link[rel="${rel}"][sizes="${attributes.sizes}"]`
    : `link[rel="${rel}"]`;
  let link = document.head.querySelector(selector);
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
  for (const [key, value] of Object.entries(attributes)) {
    link.setAttribute(key, value);
  }
}

function updateFamilyPwaLinks(pathname) {
  if (typeof window === "undefined") return;
  const isFamilyHost = window.location.hostname.toLowerCase() === "family.kaosgdd.net";
  const isFamilyPath = String(pathname || "").startsWith("/family");
  if (!isFamilyHost && !isFamilyPath) return;

  ensureHeadLink("manifest", "/family/manifest.webmanifest");
  ensureHeadLink("icon", "/family/favicon.svg", { type: "image/svg+xml" });
  ensureHeadLink("apple-touch-icon", "/family/family-apple-touch-icon.png");
}

export default function PwaBootstrap() {
  const pathname = usePathname();

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

  useEffect(() => {
    updateFamilyPwaLinks(pathname);
  }, [pathname]);

  return null;
}
