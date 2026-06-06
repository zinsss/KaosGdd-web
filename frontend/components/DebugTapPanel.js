"use client";

import { useEffect, useState } from "react";

function describeTarget(target) {
  if (!target || target === document) return "document";
  if (target === window) return "window";
  const tag = target.tagName ? target.tagName.toLowerCase() : String(target.nodeName || "unknown");
  const id = target.id ? `#${target.id}` : "";
  const className =
    typeof target.className === "string" && target.className.trim()
      ? `.${target.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : "";
  return `${tag}${id}${className}`;
}

function describePath(event) {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path
    .slice(0, 5)
    .map((target) => describeTarget(target))
    .join(" > ");
}

function formatEvent(event) {
  const point = event.touches?.[0] || event;
  const x = Number.isFinite(point.clientX) ? Math.round(point.clientX) : "-";
  const y = Number.isFinite(point.clientY) ? Math.round(point.clientY) : "-";
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return {
    timestamp,
    type: event.type,
    target: describeTarget(event.target),
    defaultPrevented: Boolean(event.defaultPrevented),
    coords: `${x},${y}`,
    path: describePath(event),
    url: `${window.location.pathname}${window.location.search}`,
  };
}

export default function DebugTapPanel() {
  const [enabled, setEnabled] = useState(false);
  const [eventLog, setEventLog] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.get("debugTap") === "1");
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    function onEvent(event) {
      const nextInfo = formatEvent(event);
      setEventLog((currentLog) => [nextInfo, ...currentLog].slice(0, 10));
      console.debug("[debugTap]", nextInfo);
    }

    document.addEventListener("pointerdown", onEvent, true);
    document.addEventListener("click", onEvent, true);
    document.addEventListener("touchstart", onEvent, true);
    return () => {
      document.removeEventListener("pointerdown", onEvent, true);
      document.removeEventListener("click", onEvent, true);
      document.removeEventListener("touchstart", onEvent, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="tapDebugPanel" aria-live="polite">
      {eventLog.length === 0
        ? "tap: none\ntarget: none\npath: none"
        : eventLog
            .map(
              (entry) =>
                `${entry.timestamp} ${entry.type} ${entry.target} prevented:${entry.defaultPrevented ? "yes" : "no"} xy:${entry.coords}
url: ${entry.url}
path: ${entry.path}`,
            )
            .join("\n\n")}
    </div>
  );
}
