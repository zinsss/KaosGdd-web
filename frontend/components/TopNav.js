"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
  const pathname = usePathname();

  const tasksActive = pathname === "/" || pathname.startsWith("/tasks");
  const remindersActive = pathname.startsWith("/reminders");

  return (
    <nav className="topNavScroller" aria-label="Primary">
      <div className="topNavRow">
        <Link className={"topNavButton" + (tasksActive ? " topNavButtonActive" : "")} href="/tasks">
          Tasks
        </Link>
        <Link className={"topNavButton" + (remindersActive ? " topNavButtonActive" : "")} href="/reminders">
          Reminders
        </Link>
      </div>
    </nav>
  );
}