"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
  const pathname = usePathname();

  const tasksActive = pathname === "/" || pathname.startsWith("/tasks");
  const remindersActive = pathname.startsWith("/reminders");
  const eventsActive = pathname.startsWith("/events");

  return (
    <nav className="topNavScroller" aria-label="Primary">
      <div className="topNavRow topNavRowFlat">
        <Link className={"topNavTextLink" + (tasksActive ? " topNavTextLinkActive" : "")} href="/tasks">
          Tasks
        </Link>
        <Link className={"topNavTextLink" + (eventsActive ? " topNavTextLinkActive" : "")} href="/events">
          Events
        </Link>
        <Link className={"topNavTextLink" + (remindersActive ? " topNavTextLinkActive" : "")} href="/reminders">
          Reminders
        </Link>
      </div>
    </nav>
  );
}