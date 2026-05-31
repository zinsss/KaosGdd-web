"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { captureCreatedEventHasType } from "../../lib/post-create-navigation";
import { UI_STRINGS } from "../../lib/strings";

const DEFAULT_WEATHER_LOCATION = "pohang";

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

function systemBadgeForEvent(event) {
  if (event.event_class === "public-holiday") {
    return { label: UI_STRINGS.HOLIDAY_BADGE, className: "eventHolidayBadge", titleClass: "eventHolidayTitle" };
  }
  if (event.event_class === "market-saturday") {
    return { label: UI_STRINGS.MARKET_BADGE, className: "eventMarketBadge", titleClass: "eventMarketTitle" };
  }
  if (event.event_class === "claim-day") {
    return { label: UI_STRINGS.CLAIM_BADGE, className: "eventClaimBadge", titleClass: "eventClaimTitle" };
  }
  if (event.is_imported_calendar_event) {
    return { label: UI_STRINGS.EVENT_BADGE, className: "eventObservanceBadge", titleClass: "eventObservanceTitle" };
  }
  return null;
}

function eventDetailHref(event) {
  const eventId = event.canonical_event_id || event.id;
  if (event.is_recurring_occurrence && event.start_date) {
    return `/events/${eventId}?occurrence=${encodeURIComponent(event.start_date)}`;
  }
  return `/events/${eventId}`;
}

export default function EventsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [todayYmd, setTodayYmd] = useState(null);
  const [month, setMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [items, setItems] = useState([]);
  const [weatherLocation, setWeatherLocation] = useState(DEFAULT_WEATHER_LOCATION);
  const [weatherLocations, setWeatherLocations] = useState([
    { id: "yeongdeok", label: "영덕" },
    { id: DEFAULT_WEATHER_LOCATION, label: "포항" },
    { id: "daegu", label: "대구" },
  ]);
  const [weatherItems, setWeatherItems] = useState([]);
  const [weatherError, setWeatherError] = useState("");
  const swipeRef = useRef({
    startX: 0,
    startY: 0,
    axis: null,
    active: false,
    handled: false,
  });

  const cells = useMemo(() => (month ? eachCalendarCell(month) : []), [month]);
  const weatherStart = cells[0] || "";
  const weatherEnd = cells[cells.length - 1] || "";

  function loadEvents() {
    if (!month) return;

    const { start, end } = monthBounds(month);
    fetch(`/api/events?start_date=${start}&end_date=${end}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }

  useEffect(() => {
    loadEvents();
  }, [month]);

  function loadWeather() {
    if (!weatherStart || !weatherEnd || !weatherLocation) return;

    fetch(`/api/weather/daily?location=${encodeURIComponent(weatherLocation)}&start_date=${weatherStart}&end_date=${weatherEnd}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) {
          setWeatherError("weather unavailable");
          setWeatherItems([]);
          if (Array.isArray(data?.locations)) setWeatherLocations(data.locations);
          return;
        }
        setWeatherError("");
        setWeatherItems(Array.isArray(data.items) ? data.items : []);
        if (Array.isArray(data.locations)) setWeatherLocations(data.locations);
      })
      .catch(() => {
        setWeatherError("weather unavailable");
        setWeatherItems([]);
      });
  }

  useEffect(() => {
    loadWeather();
  }, [weatherStart, weatherEnd, weatherLocation]);

  useEffect(() => {
    function onCaptureCreated(event) {
      if (captureCreatedEventHasType(event, "event")) loadEvents();
    }

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
  }, [month]);

  useEffect(() => {
    const now = new Date();
    const currentYmd = ymd(now);
    setTodayYmd(currentYmd);
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(currentYmd);
  }, []);

  useEffect(() => {
    setWeatherLocation(searchParams?.get("weather") || DEFAULT_WEATHER_LOCATION);
  }, [searchParams]);

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

  const weatherByDate = useMemo(() => {
    const map = new Map();
    for (const item of weatherItems) {
      if (item?.date) map.set(item.date, item);
    }
    return map;
  }, [weatherItems]);

  const monthEventsByDate = useMemo(() => {
    const unique = new Map();
    items.forEach((event, index) => {
      unique.set(event.occurrence_id || event.id, { ...event, _index: index });
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

  function changeWeatherLocation(nextLocation) {
    setWeatherLocation(nextLocation);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextLocation === DEFAULT_WEATHER_LOCATION) {
      params.delete("weather");
    } else {
      params.set("weather", nextLocation);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
          <div className="eventMonthHeaderActions">
            <div className="eventWeatherControlWrap">
              <select
                className="eventWeatherSelect"
                value={weatherLocation}
                onChange={(event) => changeWeatherLocation(event.target.value)}
                aria-label="Weather location"
              >
                {weatherLocations.map((location) => (
                  <option key={location.id} value={location.id}>{location.label}</option>
                ))}
              </select>
              {weatherError ? <span className="eventWeatherError">{weatherError}</span> : null}
            </div>
            <div className="actionRow compactActionRow">
              <button className="button compactButton buttonToneNeutral eventMonthNavButton" onClick={() => shiftMonth(-1)}>◀</button>
              <button className="button compactButton buttonToneNeutral eventMonthNavButton" onClick={() => shiftMonth(1)}>▶</button>
            </div>
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
            const dayEvents = mapByDate.get(d) || [];
            const count = dayEvents.length;
            const weather = weatherByDate.get(d);
            const hasRecurringOccurrence = dayEvents.some((event) => event.is_recurring_occurrence);
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
                {weather ? (
                  <span className="calendarDayWeather" aria-label={`Weather ${weather.min_c} to ${weather.max_c} Celsius`}>
                    <span className="calendarDayWeatherGlyph" aria-hidden="true">{weather.glyph}</span>
                    <span className="calendarDayWeatherTemp">{weather.min_c}–{weather.max_c}</span>
                  </span>
                ) : null}
                {count ? (
                  <span className="eventCalCount">
                    {hasRecurringOccurrence ? <span className="recurringOccurrenceMark" aria-label="recurring occurrence">↻</span> : null}
                    {count}
                  </span>
                ) : null}
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
                  {dateEvents.map((event) => {
                    const badge = systemBadgeForEvent(event);
                    return (
                      <li key={event.occurrence_id || event.id} className="taskListRow">
                        <div className="eventListTitleRow">
                          {badge ? <span className={"eventSystemBadge " + badge.className}>{badge.label}</span> : null}
                          {event.is_recurring_occurrence ? <span className="recurringOccurrenceMark" aria-label="recurring occurrence">↻</span> : null}
                          <Link
                            className={"taskLink taskListTitleLink" + (badge ? " " + badge.titleClass : "")}
                            href={eventDetailHref(event)}
                          >
                            {event.title}
                          </Link>
                        </div>
                        {event.end_date && event.end_date !== event.start_date ? (
                          <div className="metaLine">{event.start_date} ~ {event.end_date}</div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
