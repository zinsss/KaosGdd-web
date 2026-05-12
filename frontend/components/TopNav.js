"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UI_STRINGS } from "../lib/strings";
import { DEFAULT_MODULE_NAV_STATUS, normalizeModuleNavStatus } from "../lib/module-nav-status";

function attentionClass({ strong = false, calm = false, tone = "" }) {
  if (!strong && !calm) return "";
  const levelClass = strong ? " topNavAttentionStrong" : " topNavAttentionCalm";
  const toneClass = tone ? ` topNavAttentionTone${tone}` : "";
  return `${levelClass}${toneClass}`;
}

export default function TopNav() {
  const pathname = usePathname();
  const [navStatus, setNavStatus] = useState(DEFAULT_MODULE_NAV_STATUS);
  const navScrollRef = useRef(null);
  const [scrollHints, setScrollHints] = useState({ left: false, right: false });

  const tasksActive = pathname.startsWith("/tasks");
  const remindersActive = pathname.startsWith("/reminders");
  const eventsActive = pathname.startsWith("/events");
  const journalActive = pathname.startsWith("/journals");
  const notesActive = pathname.startsWith("/notes");
  const filesActive = pathname.startsWith("/files");
  const faxActive = pathname.startsWith("/fax");
  const settingsActive = pathname.startsWith("/settings");
  const suppliesActive = pathname.startsWith("/supplies");

  const updateScrollHints = useCallback(() => {
    const navScroll = navScrollRef.current;
    const nextHints = (() => {
      if (!navScroll) return { left: false, right: false };

      const maxScrollLeft = navScroll.scrollWidth - navScroll.clientWidth;
      if (maxScrollLeft <= 1) return { left: false, right: false };

      const scrollLeft = navScroll.scrollLeft;
      return {
        left: scrollLeft > 1,
        right: scrollLeft < maxScrollLeft - 1,
      };
    })();

    setScrollHints((currentHints) => {
      if (currentHints.left === nextHints.left && currentHints.right === nextHints.right) {
        return currentHints;
      }

      return nextHints;
    });
  }, []);

  useEffect(() => {
    const navScroll = navScrollRef.current;
    if (!navScroll) return undefined;

    updateScrollHints();
    navScroll.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollHints);
      resizeObserver.observe(navScroll);
      if (navScroll.firstElementChild) {
        resizeObserver.observe(navScroll.firstElementChild);
      }
    }

    return () => {
      navScroll.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
      resizeObserver?.disconnect();
    };
  }, [updateScrollHints]);

  useEffect(() => {
    let isMounted = true;

    async function loadNavStatus() {
      try {
        const res = await fetch("/api/nav-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        setNavStatus(normalizeModuleNavStatus(data));
      } catch {
        if (!isMounted) return;
        setNavStatus({ ...DEFAULT_MODULE_NAV_STATUS });
      }
    }

    loadNavStatus();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const taskAttentionClass = useMemo(
    () => attentionClass({ strong: navStatus.has_overdue_tasks, tone: "Maroon" }),
    [navStatus.has_overdue_tasks],
  );
  const reminderAttentionClass = useMemo(
    () => attentionClass({ strong: navStatus.has_missed_reminders, tone: "Maroon" }),
    [navStatus.has_missed_reminders],
  );
  const eventAttentionClass = useMemo(
    () => attentionClass({ calm: navStatus.has_today_events, tone: "Rosewater" }),
    [navStatus.has_today_events],
  );
  const noteAttentionClass = useMemo(
    () => attentionClass({ calm: navStatus.has_note_draft, tone: "Teal" }),
    [navStatus.has_note_draft],
  );
  const fileAttentionClass = useMemo(
    () => attentionClass({ calm: navStatus.has_file_draft, tone: "Teal" }),
    [navStatus.has_file_draft],
  );
  const suppliesAttentionClass = useMemo(
    () => attentionClass({ calm: navStatus.has_pending_supplies, tone: "Yellow" }),
    [navStatus.has_pending_supplies],
  );

  return (
    <div
      className={
        "topNavWrap" +
        (scrollHints.left ? " topNavWrapCanScrollLeft" : "") +
        (scrollHints.right ? " topNavWrapCanScrollRight" : "")
      }
    >
      <nav className="topNavScroller" aria-label="Primary" ref={navScrollRef}>
        <div className="topNavRow topNavRowFlat">
          <Link
            className={"topNavTextLink" + taskAttentionClass + (tasksActive ? " topNavTextLinkActive" : "")}
            href="/tasks"
          >
            {UI_STRINGS.TASKS}
          </Link>
          <Link
            className={"topNavTextLink" + reminderAttentionClass + (remindersActive ? " topNavTextLinkActive" : "")}
            href="/reminders"
          >
            {UI_STRINGS.REMINDERS}
          </Link>
          <Link
            className={"topNavTextLink" + eventAttentionClass + (eventsActive ? " topNavTextLinkActive" : "")}
            href="/events"
          >
            {UI_STRINGS.EVENTS}
          </Link>
          <Link className={"topNavTextLink" + (journalActive ? " topNavTextLinkActive" : "")} href="/journals">
            Journal
          </Link>
          <Link
            className={"topNavTextLink" + suppliesAttentionClass + (suppliesActive ? " topNavTextLinkActive" : "")}
            href="/supplies"
          >
            {UI_STRINGS.SUPPLIES}
          </Link>
          <Link
            className={"topNavTextLink" + noteAttentionClass + (notesActive ? " topNavTextLinkActive" : "")}
            href="/notes"
          >
            {UI_STRINGS.NOTES}
          </Link>
          <Link
            className={"topNavTextLink" + fileAttentionClass + (filesActive ? " topNavTextLinkActive" : "")}
            href="/files"
          >
            {UI_STRINGS.FILES}
          </Link>
          <Link className={"topNavTextLink" + (faxActive ? " topNavTextLinkActive" : "")} href="/fax">
            {UI_STRINGS.FAX}
          </Link>
          <Link className={"topNavTextLink" + (settingsActive ? " topNavTextLinkActive" : "")} href="/settings">
            {UI_STRINGS.SETTINGS}
          </Link>
        </div>
      </nav>
      <span className="topNavScrollHint topNavScrollHintLeft" aria-hidden="true">
        ‹
      </span>
      <span className="topNavScrollHint topNavScrollHintRight" aria-hidden="true">
        ›
      </span>
    </div>
  );
}
