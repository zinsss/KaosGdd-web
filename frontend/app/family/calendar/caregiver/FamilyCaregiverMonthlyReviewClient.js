"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  FAMILY_CALENDAR_DAY_LABELS,
  formatFamilyCaregiverHours,
  formatFamilyDateKey,
  loadFamilyCaregiverHourlyWage,
  loadFamilyCaregiverHours,
  normalizeFamilyCaregiverHourlyWage,
  padFamilyDatePart,
  saveFamilyCaregiverHourlyWage,
} from "../familyCalendarData";

function monthFromSearchParam(month) {
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, 1, 12, 0, 0, 0);
}

function formatReviewMonth(monthDate) {
  return `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월 돌봄`;
}

function formatReviewMonthParam(monthDate) {
  return `${monthDate.getFullYear()}-${padFamilyDatePart(monthDate.getMonth() + 1)}`;
}

function formatWon(value) {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
  return `${safeValue.toLocaleString("ko-KR")}원`;
}

function fixedDisplayWidth(value) {
  return Array.from(String(value ?? "")).reduce((width, character) => {
    return width + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(character) ? 2 : 1);
  }, 0);
}

function padCell(value, width = 6) {
  const text = String(value ?? "");
  return `${" ".repeat(Math.max(0, width - fixedDisplayWidth(text)))}${text}`;
}

function formatTotalHours(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildReviewWeeks(monthDate, caregiverHoursByDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const lastDate = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
  const weeks = [];
  let week = Array(7).fill(null);

  for (let day = 1; day <= lastDate; day += 1) {
    const date = new Date(year, month, day, 12, 0, 0, 0);
    const dayIndex = date.getDay();
    const dateKey = formatFamilyDateKey(date);
    week[dayIndex] = {
      day,
      hours: caregiverHoursByDate[dateKey] || 0,
    };
    if (dayIndex === 6 || day === lastDate) {
      weeks.push(week);
      week = Array(7).fill(null);
    }
  }

  return weeks;
}

function buildReviewText(monthDate, caregiverHoursByDate) {
  const weeks = buildReviewWeeks(monthDate, caregiverHoursByDate);
  const calendarIndent = "     ";
  const weekdayHeader = FAMILY_CALENDAR_DAY_LABELS.map((label) => padCell(label)).join("");
  const separator = "-".repeat(weekdayHeader.length);
  const lines = [
    formatReviewMonth(monthDate),
    "",
    `${calendarIndent}${weekdayHeader}`,
    `${calendarIndent}${separator}`,
  ];

  weeks.forEach((week, index) => {
    if (index > 0) lines.push("");
    lines.push(`${calendarIndent}${week.map((day) => padCell(day?.day || "")).join("")}`);
    lines.push(`${calendarIndent}${week.map((day) => padCell(day ? formatFamilyCaregiverHours(day.hours) || "0" : "")).join("")}`);
  });

  return lines.join("\n");
}

function summarizeMonth(monthDate, caregiverHoursByDate) {
  const weeks = buildReviewWeeks(monthDate, caregiverHoursByDate);
  return weeks.flat().filter(Boolean).reduce(
    (summary, day) => {
      if (day.hours > 0) {
        summary.days += 1;
        summary.hours += day.hours;
      }
      return summary;
    },
    { days: 0, hours: 0 },
  );
}

export default function FamilyCaregiverMonthlyReviewClient({ month }) {
  const monthDate = useMemo(() => monthFromSearchParam(month), [month]);
  const [caregiverHoursByDate, setCaregiverHoursByDate] = useState({});
  const [hourlyWage, setHourlyWage] = useState(0);

  useEffect(() => {
    setCaregiverHoursByDate(loadFamilyCaregiverHours());
    setHourlyWage(loadFamilyCaregiverHourlyWage());
  }, []);

  const reviewText = useMemo(
    () => buildReviewText(monthDate, caregiverHoursByDate),
    [caregiverHoursByDate, monthDate],
  );
  const summary = useMemo(
    () => summarizeMonth(monthDate, caregiverHoursByDate),
    [caregiverHoursByDate, monthDate],
  );
  const totalWage = summary.hours * hourlyWage;
  const monthParam = formatReviewMonthParam(monthDate);

  function changeHourlyWage(event) {
    const nextWage = normalizeFamilyCaregiverHourlyWage(event.target.value.replace(/[^\d]/g, ""));
    setHourlyWage(nextWage);
    saveFamilyCaregiverHourlyWage(nextWage);
  }

  return (
    <main className="familyCaregiverReviewPage" aria-label={formatReviewMonth(monthDate)}>
      <div className="familyCaregiverReviewHeader">
        <div>
          <h2>{formatReviewMonth(monthDate)}</h2>
        </div>
        <Link className="familyCaregiverReviewBack" href={`/family/calendar?month=${monthParam}`}>
          달력으로
        </Link>
      </div>
      <pre className="caregiverMonthlyReviewText">{reviewText}</pre>
      <section className="familyCaregiverReviewSummary" aria-label="돌봄 보수 요약">
        <div>
          <span>이번 달 총 일수/시간</span>
          <strong>{summary.days}일 / {formatTotalHours(summary.hours)}시간</strong>
        </div>
        <label>
          <span>시간당 보수</span>
          <span className="familyCaregiverWageField">
            <input
              aria-label="시간당 보수"
              inputMode="numeric"
              onChange={changeHourlyWage}
              type="text"
              value={hourlyWage.toLocaleString("ko-KR")}
            />
            원
          </span>
        </label>
        <div>
          <span>이번 달 보수</span>
          <strong>{formatWon(totalWage)}</strong>
        </div>
      </section>
    </main>
  );
}

export {
  buildReviewText,
  buildReviewWeeks,
  fixedDisplayWidth,
  formatReviewMonth,
  formatWon,
  summarizeMonth,
};
