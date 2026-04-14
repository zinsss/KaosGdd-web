"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthBounds(value) {
  const [year, month] = value.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: ymd(start), end: ymd(end), startDate: start, endDate: end };
}

function eachCalendarCell(monthValue) {
  const { startDate } = monthBounds(monthValue);
  const first = new Date(startDate);
  const day = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - day);
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return ymd(d);
  });
}

export default function EventsPageClient() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [selectedDate, setSelectedDate] = useState(ymd(now));
  const [items, setItems] = useState([]);

  const cells = useMemo(() => eachCalendarCell(month), [month]);

  useEffect(() => {
    const { start, end } = monthBounds(month);
    fetch(`/api/events?start_date=${start}&end_date=${end}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }, [month]);

  const mapByDate = useMemo(() => {
    const map = new Map();
    for (const event of items) {
      const end = event.end_date || event.start_date;
      let cursor = new Date(event.start_date + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      while (cursor <= endDate) {
        const key = ymd(cursor);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [items]);

  const monthEvents = useMemo(() => {
    const unique = new Map();
    for (const event of items) {
      unique.set(event.id, event);
    }
    return Array.from(unique.values()).sort((a, b) => {
      if (a.start_date < b.start_date) return -1;
      if (a.start_date > b.start_date) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items]);

  function shiftMonth(delta) {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">
            <span className="sectionModuleName">Events</span>
            <span className="sectionSeparator"> • </span>
            <span className="sectionContextMonth">{month}</span>
          </div>
          <div className="actionRow compactActionRow">
            <button className="button compactButton" onClick={() => shiftMonth(-1)}>◀</button>
            <button className="button compactButton" onClick={() => shiftMonth(1)}>▶</button>
          </div>
        </div>

        <div className="eventCalGrid">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div
              key={d}
              className={"eventCalHead" + (d === "Sat" ? " eventCalHeadSat" : "") + (d === "Sun" ? " eventCalHeadSun" : "")}
            >
              {d}
            </div>
          ))}
          {cells.map((d) => {
            const inMonth = d.startsWith(month);
            const count = (mapByDate.get(d) || []).length;
            return (
              <button key={d} className={"eventCalCell" + (!inMonth ? " eventCalCellMuted" : "") + (selectedDate === d ? " eventCalCellSelected" : "")} onClick={() => setSelectedDate(d)}>
                <span>{Number(d.slice(-2))}</span>
                {count ? <span className="eventCalCount">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle">{month}</div>
        {monthEvents.length === 0 ? (
          <div className="empty">No events.</div>
        ) : (
          <ul className="taskList">
            {monthEvents.map((event) => (
              <li key={event.id} className="taskListRow">
                <Link className="taskLink taskListTitleLink" href={`/events/${event.id}`}>{event.title}</Link>
                <div className="metaLine">{event.start_date}{event.end_date ? ` ~ ${event.end_date}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
