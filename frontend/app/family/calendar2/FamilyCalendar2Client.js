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
  calculateFamilyCaregiverExtraTotal,
  calculateFamilyCaregiverHours,
  fetchFamilyCalendarItems,
  fetchFamilyCaregiverHours,
  formatFamilyCaregiverHours,
  formatFamilyCaregiverWon,
  minutesToFamilyCaregiverTime,
  normalizeFamilyCaregiverDayRecord,
  normalizeFamilyCaregiverExtras,
  normalizeFamilyCaregiverSessions,
  parseFamilyCaregiverTime,
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

function hasFamilyCalendar2CaregiverRecord(value) {
  const record = normalizeFamilyCaregiverDayRecord(value);
  return calculateFamilyCaregiverHours(record) > 0 || record.extras.length > 0 || Boolean(record.memo);
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

function FamilyCalendar2CaregiverEditor({ selectedDate, caregiverHoursByDate, onChange }) {
  const [draftSessions, setDraftSessions] = useState([]);
  const [draftExtras, setDraftExtras] = useState([]);
  const [draftMemo, setDraftMemo] = useState("");
  const [draftError, setDraftError] = useState("");
  const [caregiverExpanded, setCaregiverExpanded] = useState(false);

  const savedRecord = useMemo(
    () => normalizeFamilyCaregiverDayRecord(caregiverHoursByDate[selectedDate]),
    [caregiverHoursByDate, selectedDate],
  );

  useEffect(() => {
    const normalizedSessions = savedRecord.sessions;
    if (normalizedSessions.length) {
      setDraftSessions(normalizedSessions);
    } else {
      const legacyHours = savedRecord.legacyHours || 0;
      const legacyEnd = legacyHours > 0 ? minutesToFamilyCaregiverTime(9 * 60 + Math.round(legacyHours * 60)) : "";
      setDraftSessions(legacyHours > 0 ? [{ start: "09:00", end: legacyEnd }] : []);
    }
    setDraftExtras(savedRecord.extras);
    setDraftMemo(savedRecord.memo);
    setDraftError("");
  }, [savedRecord]);

  useEffect(() => {
    setCaregiverExpanded(false);
  }, [selectedDate]);

  function updateDraftSession(index, field, value) {
    setDraftSessions((current) => current.map((session, sessionIndex) => (
      sessionIndex === index ? { ...session, [field]: value } : session
    )));
    setDraftError("");
  }

  function addDraftSession() {
    setDraftSessions((current) => {
      const previous = current.at(-1);
      const previousEnd = parseFamilyCaregiverTime(previous?.end) ?? 9 * 60;
      const start = Math.min(previousEnd, 23 * 60 - 60);
      const end = Math.min(start + 60, 23 * 60 + 59);
      return [...current, { start: minutesToFamilyCaregiverTime(start), end: minutesToFamilyCaregiverTime(end) }];
    });
    setDraftError("");
  }

  function removeDraftSession(index) {
    setDraftSessions((current) => current.filter((_, sessionIndex) => sessionIndex !== index));
    setDraftError("");
  }

  function addDraftExtra() {
    setDraftExtras((current) => [...current, { label: "", amount: "" }]);
  }

  function updateDraftExtra(index, field, value) {
    setDraftExtras((current) => current.map((extra, extraIndex) => (
      extraIndex === index
        ? { ...extra, [field]: field === "amount" ? value.replace(/[^\d]/g, "") : value }
        : extra
    )));
  }

  function removeDraftExtra(index) {
    setDraftExtras((current) => current.filter((_, extraIndex) => extraIndex !== index));
  }

  function saveDraft() {
    const normalizedSessions = normalizeFamilyCaregiverSessions(draftSessions);
    const normalizedExtras = normalizeFamilyCaregiverExtras(draftExtras);
    const memo = draftMemo.trim();
    if (normalizedSessions.length !== draftSessions.length) {
      setDraftError("끝 시간이 시작 시간보다 늦어야 해요.");
      return;
    }
    onChange(selectedDate, { sessions: normalizedSessions, extras: normalizedExtras, memo })
      .then(() => {
        setCaregiverExpanded(false);
      })
      .catch(() => {
        setDraftError("저장하지 못했어요. 다시 눌러 주세요.");
      });
  }

  function clearDraft() {
    onChange(selectedDate, { sessions: [], extras: [], memo: "" })
      .then(() => {
        setCaregiverExpanded(false);
      })
      .catch(() => {
        setDraftError("초기화하지 못했어요. 다시 눌러 주세요.");
      });
  }

  const draftTotal = calculateFamilyCaregiverHours(draftSessions);
  const savedTotal = calculateFamilyCaregiverHours(savedRecord);
  const draftExtraTotal = calculateFamilyCaregiverExtraTotal({ extras: draftExtras });

  return (
    <div className="familyCalendar2CaregiverCard" aria-label="이모 시간">
      <button
        className="familyCalendar2CaregiverHeader"
        type="button"
        aria-expanded={caregiverExpanded}
        onClick={() => setCaregiverExpanded((current) => !current)}
      >
        <span>이모</span>
        <strong>총 {formatFamilyCaregiverHours(caregiverExpanded ? draftTotal : savedTotal) || "0"}시간</strong>
      </button>
      {caregiverExpanded ? (
        <div className="familyCalendar2CaregiverEditorBody">
          <div className="familyCalendar2CaregiverEditorGrid">
            <section className="familyCalendar2CaregiverSection" aria-label="돌봄 시간">
              <strong className="familyCalendar2CaregiverSectionTitle">돌봄 시간</strong>
              <div className="familyCalendar2CaregiverSessions">
                {draftSessions.length ? draftSessions.map((session, index) => (
                  <div className="familyCalendar2CaregiverSessionRow" key={`${selectedDate}-${index}`}>
                    <span className="familyCalendar2CaregiverSessionNumber">{index + 1}</span>
                    <label className="familyCalendar2CaregiverTimeButton">
                      {session.start}
                      <input
                        aria-label="돌봄 시작 시간 선택"
                        className="familyCalendar2NativePickerInput"
                        type="time"
                        value={session.start}
                        onChange={(event) => updateDraftSession(index, "start", event.target.value)}
                      />
                    </label>
                    <span className="familyCalendar2CaregiverSessionSeparator" aria-hidden="true">~</span>
                    <label className="familyCalendar2CaregiverTimeButton">
                      {session.end}
                      <input
                        aria-label="돌봄 끝 시간 선택"
                        className="familyCalendar2NativePickerInput"
                        type="time"
                        value={session.end}
                        onChange={(event) => updateDraftSession(index, "end", event.target.value)}
                      />
                    </label>
                    <span className="familyCalendar2CaregiverSessionHours">
                      {formatFamilyCaregiverHours([session]) || "0"}시간
                    </span>
                    {draftSessions.length > 1 ? (
                      <button aria-label="돌봄 시간 삭제" className="familyCalendar2CaregiverTinyButton" type="button" onClick={() => removeDraftSession(index)}>
                        ×
                      </button>
                    ) : null}
                  </div>
                )) : <p className="familyCalendar2CaregiverEmpty">시간 추가를 누르면 입력할 수 있어요.</p>}
              </div>
              {draftError ? <p className="familyCalendar2CaregiverError">{draftError}</p> : null}
              <button className="familyCalendar2CaregiverTextButton" type="button" onClick={addDraftSession}>
                + 시간 추가
              </button>
            </section>
            <section className="familyCalendar2CaregiverSection" aria-label="추가 요금">
              <strong className="familyCalendar2CaregiverSectionTitle">추가 요금</strong>
              <div className="familyCalendar2CaregiverExtras">
                {draftExtras.map((extra, index) => (
                  <div className="familyCalendar2CaregiverExtraRow" key={`${selectedDate}-extra-${index}`}>
                    <input
                      aria-label="추가 요금 내용"
                      className="familyCalendar2CaregiverInput"
                      type="text"
                      value={extra.label}
                      placeholder="내용"
                      onChange={(event) => updateDraftExtra(index, "label", event.target.value)}
                    />
                    <input
                      aria-label="추가 요금 금액"
                      className="familyCalendar2CaregiverAmountInput"
                      inputMode="numeric"
                      type="text"
                      value={extra.amount}
                      placeholder="금액"
                      onChange={(event) => updateDraftExtra(index, "amount", event.target.value)}
                    />
                    <button aria-label="추가 요금 삭제" className="familyCalendar2CaregiverTinyButton" type="button" onClick={() => removeDraftExtra(index)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="familyCalendar2CaregiverExtraFooter">
                <button className="familyCalendar2CaregiverTextButton" type="button" onClick={addDraftExtra}>
                  + 요금 추가
                </button>
                <span>추가 {formatFamilyCaregiverWon(draftExtraTotal)}</span>
              </div>
            </section>
          </div>
          <label className="familyCalendar2CaregiverMemo">
            메모
            <textarea
              value={draftMemo}
              onChange={(event) => setDraftMemo(event.target.value)}
              placeholder="간단한 메모"
            />
          </label>
          <div className="familyCalendar2CaregiverActions">
            <button className="familyCalendar2CaregiverSave" type="button" onClick={saveDraft}>저장</button>
            <button className="familyCalendar2CaregiverClear" type="button" onClick={clearDraft}>초기화</button>
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const monthRange = useMemo(() => (month ? monthBounds(month) : null), [month]);
  const weatherStart = monthRange?.start || "";
  const weatherEnd = monthRange?.end || "";

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
    if (!selectedDate || !weatherLocation) return;
    fetchSharedWeather({ startDate: selectedDate, endDate: selectedDate })
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
  }, [selectedDate, weatherLocation]);

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

  async function handleSelectedCaregiverChange(dateKey, value) {
    if (!dateKey) return;
    const normalizedRecord = normalizeFamilyCaregiverDayRecord(value);
    const nextHours = { ...caregiverHoursByDate };
    if (normalizedRecord.sessions.length || normalizedRecord.extras.length || normalizedRecord.memo) {
      nextHours[dateKey] = normalizedRecord;
    } else {
      delete nextHours[dateKey];
    }
    setCaregiverHoursByDate(nextHours);
    try {
      await persistFamilyCaregiverHours(nextHours);
    } catch {
      setCaregiverHoursByDate(caregiverHoursByDate);
      throw new Error("caregiver hours save failed");
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
    <main className="familyCalendar2" aria-label="달력">
      <section
        className="familyCalendar2Panel familyCalendar2MonthSwipeSurface"
        onTouchStart={handleMonthSwipeTouchStart}
        onTouchMove={handleMonthSwipeTouchMove}
        onTouchEnd={resetSwipeTracking}
        onTouchCancel={resetSwipeTracking}
      >
        <div className="familyCalendar2Header">
          <div>
            <h2>달력</h2>
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
            const hasCaregiverRecord = hasFamilyCalendar2CaregiverRecord(caregiverHoursByDate[dateKey]);
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
                  {hasCaregiverRecord ? <span className="familyCalendar2CaregiverGlyph" aria-label="이모 있음">•</span> : null}
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

        {selectedDate ? (
          <FamilyCalendar2CaregiverEditor
            selectedDate={selectedDate}
            caregiverHoursByDate={caregiverHoursByDate}
            onChange={handleSelectedCaregiverChange}
          />
        ) : null}

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
