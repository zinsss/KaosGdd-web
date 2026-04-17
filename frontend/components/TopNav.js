"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UI_STRINGS } from "../lib/strings";

export default function TopNav() {
  const pathname = usePathname();

  const tasksActive = pathname === "/" || pathname.startsWith("/tasks");
  const remindersActive = pathname.startsWith("/reminders");
  const eventsActive = pathname.startsWith("/events");
  const journalsActive = pathname.startsWith("/journals");
  const notesActive = pathname.startsWith("/notes");
  const filesActive = pathname.startsWith("/files");

  return (
    <nav className="topNavScroller" aria-label="Primary">
      <div className="topNavRow topNavRowFlat">
        <Link className={"topNavTextLink" + (tasksActive ? " topNavTextLinkActive" : "")} href="/tasks">
          {UI_STRINGS.TASKS}
        </Link>
        <Link className={"topNavTextLink" + (eventsActive ? " topNavTextLinkActive" : "")} href="/events">
          {UI_STRINGS.EVENTS}
        </Link>
        <Link className={"topNavTextLink" + (remindersActive ? " topNavTextLinkActive" : "")} href="/reminders">
          {UI_STRINGS.REMINDERS}
        </Link>
        <Link className={"topNavTextLink" + (journalsActive ? " topNavTextLinkActive" : "")} href="/journals">
          {UI_STRINGS.JOURNALS}
        </Link>
        <Link className={"topNavTextLink" + (notesActive ? " topNavTextLinkActive" : "")} href="/notes">
          {UI_STRINGS.NOTES}
        </Link>
        <Link className={"topNavTextLink" + (filesActive ? " topNavTextLinkActive" : "")} href="/files">
          {UI_STRINGS.FILES}
        </Link>
      </div>
    </nav>
  );
}
