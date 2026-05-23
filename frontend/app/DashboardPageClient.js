"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UI_STRINGS } from "../lib/strings";

function badgeForEvent(event) {
  if (event.event_class === "public-holiday") return { label: UI_STRINGS.HOLIDAY_BADGE, className: "dashboardBadgeHoliday" };
  if (event.event_class === "market-saturday") return { label: UI_STRINGS.MARKET_BADGE, className: "dashboardBadgeMarket" };
  if (event.event_class === "claim-day") return { label: UI_STRINGS.CLAIM_BADGE, className: "dashboardBadgeClaim" };
  if (event.is_imported_calendar_event) return { label: UI_STRINGS.EVENT_BADGE, className: "dashboardBadgeEvent" };
  return null;
}

function EventRow({ event }) {
  const badge = badgeForEvent(event);
  const eventId = event.canonical_event_id || event.id;
  const href = event.is_recurring_occurrence && event.start_date
    ? `/events/${eventId}?occurrence=${encodeURIComponent(event.start_date)}`
    : `/events/${eventId}`;
  return (
    <li className="dashboardListRow">
      <div className="dashboardEventLine">
        {badge ? <span className={"dashboardBadge " + badge.className}>{badge.label}</span> : null}
        {event.is_recurring_occurrence ? <span className="dashboardRecurringMark" aria-label="recurring occurrence">↻</span> : null}
        <Link className="taskLink dashboardItemTitle" href={href}>{event.title}</Link>
      </div>
      <div className="metaLine dashboardMetaLine">
        {event.start_date}{event.end_date && event.end_date !== event.start_date ? ` ~ ${event.end_date}` : ""}
      </div>
    </li>
  );
}

function ReminderRow({ reminder }) {
  return (
    <li className="dashboardListRow">
      <div className="dashboardItemTitle">{reminder.title}</div>
      <div className="metaLine dashboardMetaLine">
        {reminder.remind_at_display || reminder.remind_at}
        {reminder.parent_item_title ? ` · ${reminder.parent_item_title}` : ""}
      </div>
    </li>
  );
}

export default function DashboardPageClient() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  function loadDashboard() {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setDashboard(data);
        setError("");
      })
      .catch(() => {
        setDashboard(null);
        setError(UI_STRINGS.DASHBOARD_LOAD_FAILED);
      });
  }

  useEffect(() => {
    loadDashboard();
    function onCaptureCreated() {
      loadDashboard();
    }
    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
  }, []);

  const flagBadges = useMemo(() => {
    if (!dashboard) return [];
    const flags = [];
    if (dashboard.flags?.is_public_holiday) flags.push({ label: UI_STRINGS.HOLIDAY_BADGE, className: "dashboardBadgeHoliday" });
    if (dashboard.flags?.is_market_saturday) flags.push({ label: UI_STRINGS.MARKET_BADGE, className: "dashboardBadgeMarket" });
    if (dashboard.flags?.is_claim_day) flags.push({ label: UI_STRINGS.CLAIM_BADGE, className: "dashboardBadgeClaim" });
    return flags;
  }, [dashboard]);

  if (error) {
    return <main className="page"><section className="panel"><div className="errorText">{error}</div></section></main>;
  }

  if (!dashboard) {
    return <main className="page"><section className="panel"><div className="empty">{UI_STRINGS.DASHBOARD_LOADING}</div></section></main>;
  }

  return (
    <main className="page dashboardPage">
      <section className="panel dashboardHero">
        <div>
          <div className="dashboardDate">{dashboard.date_display}</div>
          <div className="dashboardSubline">{UI_STRINGS.DASHBOARD_TITLE}</div>
        </div>
        {flagBadges.length ? (
          <div className="dashboardBadgeRow">
            {flagBadges.map((badge) => <span key={badge.label} className={"dashboardBadge " + badge.className}>{badge.label}</span>)}
          </div>
        ) : null}
      </section>

      <section className="dashboardGrid">
        <div className="panel">
          <div className="sectionTitle">{UI_STRINGS.TODAY_EVENTS}</div>
          {dashboard.today_events.length ? (
            <ul className="dashboardList">{dashboard.today_events.map((event) => <EventRow key={event.occurrence_id || event.id} event={event} />)}</ul>
          ) : (
            <div className="empty">{UI_STRINGS.NO_TODAY_EVENTS}</div>
          )}
        </div>

        <div className="panel">
          <div className="sectionTitle">{UI_STRINGS.TASK_SUMMARY}</div>
          <div className="dashboardCounts">
            <Link href="/tasks" className="dashboardCountTile dashboardCountOverdue">
              <span>{dashboard.task_counts.overdue}</span>
              <small>{UI_STRINGS.OVERDUE}</small>
            </Link>
            <Link href="/tasks" className="dashboardCountTile dashboardCountToday">
              <span>{dashboard.task_counts.today}</span>
              <small>{UI_STRINGS.TODAY}</small>
            </Link>
            <Link href="/tasks" className="dashboardCountTile">
              <span>{dashboard.task_counts.active_total}</span>
              <small>{UI_STRINGS.ACTIVE_TOTAL}</small>
            </Link>
          </div>
        </div>
      </section>

      <section className="dashboardGrid">
        <div className="panel">
          <div className="sectionTitle">{UI_STRINGS.UPCOMING_EVENTS}</div>
          {dashboard.upcoming_events.length ? (
            <ul className="dashboardList">{dashboard.upcoming_events.map((event) => <EventRow key={event.occurrence_id || event.id} event={event} />)}</ul>
          ) : (
            <div className="empty">{UI_STRINGS.NO_UPCOMING_EVENTS}</div>
          )}
        </div>

        <div className="panel">
          <div className="sectionTitle">{UI_STRINGS.TODAY_REMINDERS}</div>
          {dashboard.today_reminders.length ? (
            <ul className="dashboardList">{dashboard.today_reminders.map((reminder) => <ReminderRow key={reminder.id} reminder={reminder} />)}</ul>
          ) : (
            <div className="empty">{UI_STRINGS.NO_TODAY_REMINDERS}</div>
          )}
        </div>
      </section>
    </main>
  );
}
