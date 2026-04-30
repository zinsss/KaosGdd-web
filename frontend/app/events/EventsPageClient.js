"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [todayYmd, setTodayYmd] = useState(null);
  const [month, setMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [items, setItems] = useState([]);
  const swipeRef = useRef({
    startX: 0,
    startY: 0,
    axis: null,
    active: false,
    handled: false,
  });

  const cells = useMemo(() => (month ? eachCalendarCell(month) : []), [month]);

  useEffect(() => {
    if (!month) return;

    const { start, end } = monthBounds(month);
    fetch(`/api/events?start_date=${start}&end_date=${end}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }, [month]);

  useEffect(() => {
    const now = new Date();
    const currentYmd = ymd(now);
    setTodayYmd(currentYmd);
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(currentYmd);
  }, []);

  useEffect(() => {
    document.body.classList.add("eventsPageActive");
    return () => {
      document.body.classList.remove("eventsPageActive");
    };
  }, []);

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

  const monthEventsByDate = useMemo(() => {
    const unique = new Map();
    items.forEach((event, index) => {
      unique.set(event.id, { ...event, _index: index });
    });
    const sorted = Array.from(unique.values()).sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date.localeCompare(b.start_date);
      const aEnd = a.end_date || a.start_date;
      const bEnd = b.end_date || b.start_date;
      if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
      return a._index - b._index;
    });
    const grouped = new Map();
    for (const event of sorted) {
      if (!grouped.has(event.start_date)) grouped.set(event.start_date, []);
      grouped.get(event.start_date).push(event);
    }
    return Array.from(grouped.entries());
  }, [items]);

  function shiftMonth(delta) {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  function resetSwipeTracking() {
    swipeRef.current.active = false;
    swipeRef.current.axis = null;
    swipeRef.current.handled = false;
  }

  function handleMonthSwipeTouchStart(event) {
    if (event.touches.length !== 1) {
      resetSwipeTracking();
      return;
    }
    const touch = event.touches[0];
    swipeRef.current.startX = touch.clientX;
    swipeRef.current.startY = touch.clientY;
    swipeRef.current.axis = null;
    swipeRef.current.active = true;
    swipeRef.current.handled = false;
  }

  function handleMonthSwipeTouchMove(event) {
    if (!swipeRef.current.active || swipeRef.current.handled || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = touch.clientX - swipeRef.current.startX;
    const dy = touch.clientY - swipeRef.current.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!swipeRef.current.axis && (absX >= 10 || absY >= 10)) {
      swipeRef.current.axis = absX > absY * 1.35 ? "x" : "y";
    }

    if (swipeRef.current.axis !== "x") return;

    if (absX >= 64 && absY <= 40) {
      shiftMonth(dx < 0 ? 1 : -1);
      swipeRef.current.handled = true;
      swipeRef.current.active = false;
    }
  }

  return (
    <main className="page eventsPage">
      <section
        className="panel eventMonthSwipeSurface"
        onTouchStart={handleMonthSwipeTouchStart}
        onTouchMove={handleMonthSwipeTouchMove}
        onTouchEnd={resetSwipeTracking}
        onTouchCancel={resetSwipeTracking}
      >
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">
            <span className="sectionModuleName">Events</span>
            <span className="sectionSeparator"> • </span>
            <span className="sectionContextMonth">{month}</span>
          </div>
          <div className="actionRow compactActionRow">
            <button className="button compactButton eventMonthNavButton" onClick={() => shiftMonth(-1)}>◀</button>
            <button className="button compactButton eventMonthNavButton" onClick={() => shiftMonth(1)}>▶</button>
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
            const dayOfWeek = new Date(`${d}T00:00:00`).getDay();
            const dayClass = dayOfWeek === 0 ? " eventCalDaySun" : dayOfWeek === 6 ? " eventCalDaySat" : "";
            return (
              <button
                key={d}
                className={
                  "eventCalCell" +
                  (!inMonth ? " eventCalCellMuted" : "") +
                  (selectedDate === d ? " eventCalCellSelected" : "") +
                  (todayYmd === d ? " eventCalCellToday" : "")
                }
                onClick={() => setSelectedDate(d)}
              >
                <span className={"eventCalDayNumber" + dayClass}>{Number(d.slice(-2))}</span>
                {count ? <span className="eventCalCount">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="sectionTitle">{month}</div>
        {monthEventsByDate.length === 0 ? (
          <div className="empty">No events.</div>
        ) : (
          <div className="eventMonthGroups">
            {monthEventsByDate.map(([date, dateEvents]) => (
              <div key={date} className="eventMonthGroup">
                <div className="eventMonthGroupHeading">{date}</div>
                <ul className="taskList">
                  {dateEvents.map((event) => (
                    <li key={event.id} className="taskListRow">
                      <Link className="taskLink taskListTitleLink" href={`/events/${event.id}`}>{event.title}</Link>
                      {event.end_date && event.end_date !== event.start_date ? (
                        <div className="metaLine">{event.start_date} ~ {event.end_date}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
