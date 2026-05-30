"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getAppHeaderTitleClassName } from "../lib/app-title-attention";
import { DEFAULT_MODULE_NAV_STATUS, normalizeModuleNavStatus } from "../lib/module-nav-status";
import { UI_STRINGS } from "../lib/strings";

const TITLE_STATUS_REFRESH_MS = 30000;

export default function AppHeaderTitle() {
  const pathname = usePathname();
  const [status, setStatus] = useState(DEFAULT_MODULE_NAV_STATUS);

  const loadTitleStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/nav-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(normalizeModuleNavStatus(data));
    } catch {
      setStatus({ ...DEFAULT_MODULE_NAV_STATUS });
    }
  }, []);

  useEffect(() => {
    loadTitleStatus();
  }, [loadTitleStatus, pathname]);

  useEffect(() => {
    function onCaptureCreated() {
      loadTitleStatus();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadTitleStatus();
      }
    }

    const intervalId = window.setInterval(loadTitleStatus, TITLE_STATUS_REFRESH_MS);

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadTitleStatus]);

  return (
    <Link className={getAppHeaderTitleClassName(status)} href="/">
      {UI_STRINGS.APP_TITLE}
    </Link>
  );
}
