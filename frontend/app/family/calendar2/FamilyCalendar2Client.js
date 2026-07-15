"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatEventCountGlyph } from "../../../lib/events/event-count-glyphs";
import {
  DEFAULT_WEATHER_LOCATION,
  DEFAULT_WEATHER_LOCATIONS,
  fetchSharedWeather,
  getStoredWeatherLocation,
  listenWeatherLocationChange,
  normalizeWeatherLocations,
  setStoredWeatherLocation,
  sharedWeatherDailyFromPayload,
  sharedWeatherDaypartsFromPayload,
} from "../../lib/weather-client";
import {
  calculateFamilyCaregiverHours,
  FAMILY_CAREGIVER_HOUR_VALUES,
  fetchFamilyCalendarItems,
  fetchFamilyCaregiverHours,
  formatFamilyCaregiverHours,
  normalizeFamilyCaregiverDayRecord,
  persistFamilyCaregiverHours,
} from "../calendar/familyCalendarData";
import { fetchFamilyTasks, formatFamilyTaskDueDate } from "../familyTasks";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("a, button, input, textarea, select, option"));
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthBounds(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: ymd(start), end: ymd(end), startDate: start, endDate: end };
}

function monthValueForDate(dateValue) {
  return String(dateValue || "").slice(0, 7);
}

function isValidYmd(value) {
  if (!DATE_RE.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && ymd(date) === value;
}

function eachCalendarCell(monthValue) {
  const { startDate } = monthBounds(monthValue);
  const first = new Date(startDate);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return ymd(d);
  });
}

function eventMatchesDate(event, dateKey) {
  const eventDate = event.date || event.event_date || event.start_date;
  const endDate = event.end_date || eventDate;
  return eventDate && eventDate <= dateKey && dateKey <= endDate;
}

function taskMatchesDate(task, dateKey) {
  return !task.done && task.due_date === dateKey;
}

function eventTimeLabel(event) {
  if (event.allDay) return "";
  if (event.startTime && event.endTime) return `${event.startTime}-${event.endTime}`;
  if (event.startTime) return event.startTime;
  return "";
}

function selectedDayItemSort(a, b) {
  const kindOrder = { event: 0, task: 1 };
  const kindDiff = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
  if (kindDiff) return kindDiff;
  return String(a.time || "").localeCompare(String(b.time || ""));
}

export default function FamilyCalendar2Client() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [todayYmd, setTodayYmd] = useState(null);
  const [month, setMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [caregiverHoursByDate, setCaregiverHoursByDate] = useState({});
  const [weatherLocation, setWeatherLocation] = useState(DEFAULT_WEATHER_LOCATION);
  const [weatherLocations, setWeatherLocations] = useState(DEFAULT_WEATHER_LOCATIONS);
  const [weatherItems, setWeatherItems] = useState([]);
  const [weatherError, setWeatherError] = useState("");
  const [weatherDayparts, setWeatherDayparts] = useState([]);
  const [weatherDaypartsAvailable, setWeatherDaypartsAvailable] = useState(false);
  const [weatherDaypartsReason, setWeatherDaypartsReason] = useState("날씨 정보가 없어요.");
  const swipeRef = useRef({ startX: 0, startY: 0, axis: null, active: false, handled: false });

  const cells = useMemo(() => (month ? eachCalendarCell(month) : []), [month]);
  const weatherStart = cells[0] || "";
  const weatherEnd = cells[cells.length - 1] || "";

  useEffect(() => {
    const now = new Date();
    const currentYmd = ymd(now);
    const dateParam = searchParams?.get("date");
    const initialSelectedDate = isValidYmd(dateParam) ? dateParam : currentYmd;
    setTodayYmd(currentYmd);
    setMonth(monthValueForDate(initialSelectedDate));
    setSelectedDate(initialSelectedDate);
  }, [searchParams]);

  useEffect(() => {
    const queryLocation = searchParams?.get("weather");
    setWeatherLocation(queryLocation || getStoredWeatherLocation());
  }, [searchParams]);

  useEffect(() => {
    return listenWeatherLocationChange((nextLocation) => {
      if (!searchParams?.get("weather")) setWeatherLocation(nextLocation);
    });
  }, [searchParams]);

  useEffect(() => {
    if (!month) return;
    const { start, end } = monthBounds(month);
    Promise.all([
      fetchFamilyCalendarItems({ startDate: start, endDate: end }),
      fetchFamilyTasks(),
      fetchFamilyCaregiverHours(),
    ]).then(([nextEvents, nextTasks, nextCaregiverHours]) => {
      setEvents(nextEvents);
      setTasks(nextTasks);
      setCaregiverHoursByDate(nextCaregiverHours);
    }).catch(() => {
      setEvents([]);
      setTasks([]);
      setCaregiverHoursByDate({});
    });
  }, [month]);

  useEffect(() => {
    if (!weatherStart || !weatherEnd || !weatherLocation) return;
    fetchSharedWeather({ startDate: weatherStart, endDate: weatherEnd })
      .then((sharedWeather) => {
        const data = sharedWeatherDailyFromPayload(sharedWeather, { location: weatherLocation, startDate: weatherStart, endDate: weatherEnd });
        if (!data?.ok) {
          setWeatherError("날씨 없음");
          setWeatherItems([]);
          setWeatherLocations(normalizeWeatherLocations(data?.locations));
          return;
        }
        setWeatherError("");
        setWeatherItems(Array.isArray(data.items) ? data.items : []);
        setWeatherLocations(normalizeWeatherLocations(data?.locations));
      })
      .catch(() => {
        setWeatherError("날씨 없음");
        setWeatherItems([]);
      });
  }, [weatherStart, weatherEnd, weatherLocation]);

  useEffect(() => {
    if (!selectedDate || !weatherLocation || !weatherStart || !weatherEnd) return;
    fetchSharedWeather({ startDate: weatherStart, endDate: weatherEnd })
      .then((sharedWeather) => {
        const data = sharedWeatherDaypartsFromPayload(sharedWeather, { location: weatherLocation, date: selectedDate });
        setWeatherDaypartsAvailable(Boolean(data?.weather_dayparts_available));
        setWeatherDayparts(Array.isArray(data?.weather_dayparts) ? data.weather_dayparts : []);
        setWeatherDaypartsReason(data?.weather_unavailable_reason || "날씨 정보가 없어요.");
      })
      .catch(() => {
        setWeatherDaypartsAvailable(false);
        setWeatherDayparts([]);
        setWeatherDaypartsReason("날씨 정보가 없어요.");
      });
  }, [selectedDate, weatherLocation, weatherStart, weatherEnd]);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const dateKey of cells) {
      const dayEvents = events.filter((event) => eventMatchesDate(event, dateKey));
      if (dayEvents.length) map.set(dateKey, dayEvents);
    }
    return map;
  }, [cells, events]);

  const tasksByDate = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      if (!task.due_date || task.done) continue;
      if (!map.has(task.due_date)) map.set(task.due_date, []);
      map.get(task.due_date).push(task);
    }
    return map;
  }, [tasks]);

  const weatherByDate = useMemo(() => {
    const map = new Map();
    for (const item of weatherItems) {
      if (item?.date) map.set(item.date, item);
    }
    return map;
  }, [weatherItems]);

  const selectedDayWeather = selectedDate ? weatherByDate.get(selectedDate) : null;
  const selectedCaregiverHours = selectedDate ? calculateFamilyCaregiverHours(caregiverHoursByDate[selectedDate]) : 0;

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    const eventItems = (eventsByDate.get(selectedDate) || []).map((event) => ({
      kind: "event",
      id: event.id,
      title: event.title,
      time: eventTimeLabel(event),
      href: `/family/calendar/events/${event.id}/edit`,
    }));
    const taskItems = (tasksByDate.get(selectedDate) || []).map((task) => ({
      kind: "task",
      id: task.id,
      title: task.title,
      time: formatFamilyTaskDueDate(task.due_date),
      href: `/family/tasks/${task.id}/edit`,
    }));
    return [...eventItems, ...taskItems].sort(selectedDayItemSort);
  }, [eventsByDate, selectedDate, tasksByDate]);

  async function updateSelectedCaregiverHours(nextValue) {
    if (!selectedDate) return;
    const normalizedValue = Number(nextValue);
    const nextHours = { ...caregiverHoursByDate };
    const currentRecord = normalizeFamilyCaregiverDayRecord(nextHours[selectedDate]);
    if (!normalizedValue) {
      if (currentRecord.extras.length) {
        nextHours[selectedDate] = { ...currentRecord, legacyHours: null, sessions: [] };
      } else {
        delete nextHours[selectedDate];
      }
    } else {
      nextHours[selectedDate] = { ...currentRecord, legacyHours: normalizedValue, sessions: [] };
    }
    setCaregiverHoursByDate(nextHours);
    try {
      await persistFamilyCaregiverHours(nextHours);
    } catch {
      setCaregiverHoursByDate(caregiverHoursByDate);
    }
  }

  function updateSelectedDate(nextDate, options = {}) {
    if (!isValidYmd(nextDate)) return;
    setSelectedDate(nextDate);
    setMonth(monthValueForDate(nextDate));
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (nextDate === todayYmd) params.delete("date");
    else params.set("date", nextDate);
    if (options.weatherLocation) {
      if (options.weatherLocation === DEFAULT_WEATHER_LOCATION) params.delete("weather");
      else params.set("weather", options.weatherLocation);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function shiftMonth(delta) {
    if (!month) return;
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    const nextSelectedDate = todayYmd && nextMonth === monthValueForDate(todayYmd) ? todayYmd : `${nextMonth}-01`;
    updateSelectedDate(nextSelectedDate);
  }

  function changeWeatherLocation(nextLocation) {
    const storedLocation = setStoredWeatherLocation(nextLocation);
    setWeatherLocation(storedLocation);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (storedLocation === DEFAULT_WEATHER_LOCATION) params.delete("weather");
    else params.set("weather", storedLocation);
    if (selectedDate && selectedDate !== todayYmd) params.set("date", selectedDate);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function resetSwipeTracking() {
    swipeRef.current.active = false;
    swipeRef.current.axis = null;
    swipeRef.current.handled = false;
  }

  function handleMonthSwipeTouchStart(event) {
    if (isInteractiveTarget(event.target) || event.touches.length !== 1) {
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
    <main className="familyCalendar2" aria-label="달력2">
      <section
        className="familyCalendar2Panel familyCalendar2MonthSwipeSurface"
        onTouchStart={handleMonthSwipeTouchStart}
        onTouchMove={handleMonthSwipeTouchMove}
        onTouchEnd={resetSwipeTracking}
        onTouchCancel={resetSwipeTracking}
      >
        <div className="familyCalendar2Header">
          <div>
            <h2>달력2</h2>
            <p>{month}</p>
          </div>
          <div className="familyCalendar2HeaderActions">
            <select
              className="familyCalendar2WeatherSelect"
              value={weatherLocation}
              onChange={(event) => changeWeatherLocation(event.target.value)}
              aria-label="날씨 지역"
            >
              {weatherLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
            {weatherError ? <span className="familyCalendar2WeatherError">{weatherError}</span> : null}
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="이전 달">‹</button>
            <button type="button" onClick={() => todayYmd && updateSelectedDate(todayYmd)} disabled={!todayYmd}>오늘</button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달">›</button>
            <Link className="familyCalendar2AddLink" href={`/family/calendar/events/new?date=${selectedDate || todayYmd || ""}&allDay=1`}>
              + 일정
            </Link>
          </div>
        </div>

        <div className="familyCalendar2Grid">
          {DAY_LABELS.map((label, index) => (
            <div
              className={"familyCalendar2Head" + (index === 0 ? " familyCalendar2Sunday" : "") + (index === 6 ? " familyCalendar2Saturday" : "")}
              key={label}
            >
              {label}
            </div>
          ))}
          {cells.map((dateKey) => {
            const date = new Date(`${dateKey}T00:00:00`);
            const inMonth = month && dateKey.startsWith(month);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const dayTasks = tasksByDate.get(dateKey) || [];
            const hasCaregiverHours = calculateFamilyCaregiverHours(caregiverHoursByDate[dateKey]) > 0;
            const count = dayEvents.length + dayTasks.length;
            const countGlyph = formatEventCountGlyph(count);
            const weather = weatherByDate.get(dateKey);
            const dayClass = date.getDay() === 0
              ? " familyCalendar2Sunday"
              : date.getDay() === 6
                ? " familyCalendar2Saturday"
                : "";
            const isSelected = selectedDate === dateKey;
            const isToday = todayYmd === dateKey;
            return (
              <button
                type="button"
                className={
                  "familyCalendar2Cell" +
                  (!inMonth ? " familyCalendar2CellMuted" : "") +
                  (isSelected ? " familyCalendar2CellSelected" : "") +
                  (isToday ? " familyCalendar2CellToday" : "")
                }
                key={dateKey}
                onClick={() => updateSelectedDate(dateKey)}
              >
                <span className="familyCalendar2CellTop">
                  <span className={"familyCalendar2DayNumber" + dayClass}>{Number(dateKey.slice(-2))}</span>
                  {weather ? <span className="familyCalendar2WeatherGlyph" aria-hidden="true">{weather.glyph}</span> : null}
                </span>
                <span className="familyCalendar2Footer">
                  {hasCaregiverHours ? <span className="familyCalendar2CaregiverGlyph" aria-label="이모 있음">󱁷</span> : null}
                  {countGlyph ? <span className="familyCalendar2Count">{countGlyph}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="familyCalendar2Panel familyCalendar2SelectedDayPanel">
        <div className="familyCalendar2SelectedTitle">선택한 날 · {selectedDate || todayYmd || ""}</div>
        <div className="familyCalendar2SelectedWeather">
          {selectedDayWeather || (weatherDaypartsAvailable && weatherDayparts.length > 0) ? (
            <div className="familyCalendar2SelectedWeatherLayout">
              <div className="familyCalendar2SelectedWeatherSummary">
                <span className="familyCalendar2SelectedWeatherGlyph" aria-hidden="true">{selectedDayWeather?.glyph || "·"}</span>
                <span className="familyCalendar2SelectedWeatherRange">
                  {selectedDayWeather ? `${selectedDayWeather.min_c}–${selectedDayWeather.max_c}` : "—"}
                </span>
              </div>
              <div className="familyCalendar2DaypartGrid">
                {weatherDaypartsAvailable && weatherDayparts.length > 0 ? (
                  weatherDayparts.map((daypart) => (
                    <div className="familyCalendar2DaypartRow" key={daypart.label}>
                      <span>{daypart.label}</span>
                      <span>
                        <span aria-hidden="true">{daypart.glyph}</span>
                        <span>{daypart.temp_min_c}–{daypart.temp_max_c}</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="familyCalendar2Empty">{weatherDaypartsReason}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="familyCalendar2Empty">{weatherDaypartsReason}</div>
          )}
        </div>

        <div className="familyCalendar2CaregiverCard" aria-label="이모 시간">
          <div className="familyCalendar2CaregiverHeader">
            <span>이모</span>
            <strong>{formatFamilyCaregiverHours(selectedCaregiverHours) || "0"}시간</strong>
          </div>
          <div className="familyCalendar2CaregiverPicker">
            {FAMILY_CAREGIVER_HOUR_VALUES.map((value) => (
              <button
                type="button"
                className={"familyCalendar2CaregiverOption" + (selectedCaregiverHours === value ? " familyCalendar2CaregiverOptionActive" : "")}
                key={value}
                onClick={() => updateSelectedCaregiverHours(value)}
              >
                {value === 0 ? "0" : formatFamilyCaregiverHours(value)}
              </button>
            ))}
          </div>
        </div>

        {selectedDayItems.length === 0 ? (
          <div className="familyCalendar2Empty">이 날에는 아직 적힌 일정이 없어요.</div>
        ) : (
          <ul className="familyCalendar2SelectedList">
            {selectedDayItems.map((item) => (
              <li className={`familyCalendar2SelectedItem familyCalendar2SelectedItem-${item.kind}`} key={`${item.kind}-${item.id}`}>
                <span className="familyCalendar2SelectedKind">
                  {item.kind === "task" ? "할일" : "일정"}
                </span>
                {item.href ? (
                  <Link href={item.href}>{item.title}</Link>
                ) : (
                  <span>{item.title}</span>
                )}
                {item.time ? <small>{item.time}</small> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
