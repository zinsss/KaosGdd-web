"use client";

import { useEffect } from "react";

const SHELL_HEIGHT_VAR = "--app-shell-measured-height";

export default function AppShellHeightObserver() {
  useEffect(() => {
    const shell = document.querySelector(".appShellTop");
    const attentionSlot = document.querySelector(".appShellAttentionSlot");
    if (!shell) return undefined;

    const rootStyle = document.documentElement.style;
    let lastMeasuredHeight = "";
    let rafId = 0;

    const writeMeasuredHeight = () => {
      rafId = 0;
      const shellHeight = shell.getBoundingClientRect().height;
      const attentionHeight = attentionSlot?.getBoundingClientRect().height || 0;
      const measuredHeight = `${Math.ceil(shellHeight + attentionHeight)}px`;
      if (measuredHeight === lastMeasuredHeight) return;

      lastMeasuredHeight = measuredHeight;
      rootStyle.setProperty(SHELL_HEIGHT_VAR, measuredHeight);
    };

    const scheduleMeasuredHeight = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(writeMeasuredHeight);
    };

    scheduleMeasuredHeight();

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleMeasuredHeight);
    resizeObserver?.observe(shell);
    if (attentionSlot) {
      resizeObserver?.observe(attentionSlot);
    }

    window.addEventListener("resize", scheduleMeasuredHeight);
    window.visualViewport?.addEventListener("resize", scheduleMeasuredHeight);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasuredHeight);
      window.visualViewport?.removeEventListener("resize", scheduleMeasuredHeight);
      rootStyle.removeProperty(SHELL_HEIGHT_VAR);
    };
  }, []);

  return null;
}
