"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

  const homeActive = pathname === "/";
  const tasksActive = pathname.startsWith("/tasks");
  const remindersActive = pathname.startsWith("/reminders");
  const eventsActive = pathname.startsWith("/events");
  const journalsActive = pathname.startsWith("/journals");
  const notesActive = pathname.startsWith("/notes");
  const filesActive = pathname.startsWith("/files");
  const faxActive = pathname.startsWith("/fax");
  const suppliesActive = pathname.startsWith("/supplies");
  const captureActive = pathname.startsWith("/capture");

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
    <nav className="topNavScroller" aria-label="Primary">
      <div className="topNavRow topNavRowFlat">
        <Link className={"topNavTextLink" + (homeActive ? " topNavTextLinkActive" : "")} href="/">
          {UI_STRINGS.HOME}
        </Link>
        <Link
          className={"topNavTextLink" + taskAttentionClass + (tasksActive ? " topNavTextLinkActive" : "")}
          href="/tasks"
        >
          {UI_STRINGS.TASKS}
        </Link>
        <Link
          className={"topNavTextLink" + eventAttentionClass + (eventsActive ? " topNavTextLinkActive" : "")}
          href="/events"
        >
          {UI_STRINGS.EVENTS}
        </Link>
        <Link
          className={"topNavTextLink" + reminderAttentionClass + (remindersActive ? " topNavTextLinkActive" : "")}
          href="/reminders"
        >
          {UI_STRINGS.REMINDERS}
        </Link>
        <Link className={"topNavTextLink" + (journalsActive ? " topNavTextLinkActive" : "")} href="/journals">
          {UI_STRINGS.JOURNALS}
        </Link>
        <Link className={"topNavTextLink" + noteAttentionClass + (notesActive ? " topNavTextLinkActive" : "")} href="/notes">
          {UI_STRINGS.NOTES}
        </Link>
        <Link className={"topNavTextLink" + fileAttentionClass + (filesActive ? " topNavTextLinkActive" : "")} href="/files">
          {UI_STRINGS.FILES}
        </Link>
        <Link className={"topNavTextLink" + (faxActive ? " topNavTextLinkActive" : "")} href="/fax">
          {UI_STRINGS.FAX}
        </Link>
        <Link
          className={"topNavTextLink" + suppliesAttentionClass + (suppliesActive ? " topNavTextLinkActive" : "")}
          href="/supplies"
        >
          {UI_STRINGS.SUPPLIES}
        </Link>
        <Link className={"topNavTextLink" + (captureActive ? " topNavTextLinkActive" : "")} href="/capture">
          {UI_STRINGS.CAPTURE}
        </Link>
      </div>
    </nav>
  );
}
