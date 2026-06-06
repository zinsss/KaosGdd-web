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
  return {
    type: event.type,
    target: describeTarget(event.target),
    defaultPrevented: Boolean(event.defaultPrevented),
    coords: `${x},${y}`,
    path: describePath(event),
  };
}

export default function DebugTapPanel() {
  const [enabled, setEnabled] = useState(false);
  const [eventInfo, setEventInfo] = useState({
    type: "none",
    target: "none",
    defaultPrevented: false,
    coords: "-",
    path: "none",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.get("debugTap") === "1");
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    function onEvent(event) {
      const nextInfo = formatEvent(event);
      setEventInfo(nextInfo);
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
      {`tap: ${eventInfo.type}
target: ${eventInfo.target}
prevented: ${eventInfo.defaultPrevented ? "yes" : "no"}
xy: ${eventInfo.coords}
path: ${eventInfo.path}`}
    </div>
  );
}
