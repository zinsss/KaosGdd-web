"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  calculateFamilyCaregiverExtraTotal,
  calculateFamilyCaregiverHours,
  FAMILY_CALENDAR_DAY_LABELS,
  formatFamilyCaregiverWon,
  formatFamilyCaregiverHours,
  formatFamilyDateKey,
  loadFamilyCaregiverHourlyWage,
  loadFamilyCaregiverHours,
  loadFamilyCaregiverMonthlySettings,
  normalizeFamilyCaregiverDayRecord,
  normalizeFamilyCaregiverHourlyWage,
  normalizeFamilyCaregiverMonthlySettingsMap,
  padFamilyDatePart,
  resolveFamilyCaregiverMonthlySetting,
  saveFamilyCaregiverMonthlySettings,
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
  return formatFamilyCaregiverWon(value);
}

function fixedDisplayWidth(value) {
  return Array.from(String(value ?? "")).reduce((width, character) => {
    return width + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(character) ? 2 : 1);
  }, 0);
}

const REVIEW_CALENDAR_CELL_WIDTH = 6;

function padCell(value, width = REVIEW_CALENDAR_CELL_WIDTH) {
  const text = String(value ?? "");
  return `${text}${" ".repeat(Math.max(0, width - fixedDisplayWidth(text)))}`;
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
      dateKey,
      day,
      hours: calculateFamilyCaregiverHours(caregiverHoursByDate[dateKey]),
      extras: calculateFamilyCaregiverExtraTotal(caregiverHoursByDate[dateKey]),
      extraNotes: formatDailyExtraNotes(caregiverHoursByDate[dateKey]),
    };
    if (dayIndex === 6 || day === lastDate) {
      weeks.push(week);
      week = Array(7).fill(null);
    }
  }

  return weeks;
}

function formatDailyExtraNotes(value) {
  const record = normalizeFamilyCaregiverDayRecord(value);
  return record.extras.map((extra) => `${extra.label || "추가"} ${extra.amount.toLocaleString("ko-KR")}`).join(", ");
}

function buildReviewText(monthDate, caregiverHoursByDate) {
  const weeks = buildReviewWeeks(monthDate, caregiverHoursByDate);
  const calendarIndent = "     ";
  const separatorIndent = "   ";
  const weekdayHeader = FAMILY_CALENDAR_DAY_LABELS.map((label) => padCell(label)).join("");
  const separator = "-".repeat(FAMILY_CALENDAR_DAY_LABELS.length * REVIEW_CALENDAR_CELL_WIDTH);
  const lines = [
    formatReviewMonth(monthDate),
    "",
    `${calendarIndent}${weekdayHeader}`,
    `${separatorIndent}${separator}`,
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
      summary.extras += day.extras;
      return summary;
    },
    { days: 0, hours: 0, extras: 0 },
  );
}

function buildDailyBreakdown(monthDate, caregiverHoursByDate, hourlyWage) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const lastDate = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
  return Array.from({ length: lastDate }, (_, index) => {
    const date = new Date(year, month, index + 1, 12, 0, 0, 0);
    const dateKey = formatFamilyDateKey(date);
    const value = caregiverHoursByDate[dateKey];
    const hours = calculateFamilyCaregiverHours(value);
    const extras = calculateFamilyCaregiverExtraTotal(value);
    return {
      dateLabel: `${month + 1}/${index + 1}`,
      weekday: FAMILY_CALENDAR_DAY_LABELS[date.getDay()],
      hours,
      basePay: hours * hourlyWage,
      extras,
      notes: formatDailyExtraNotes(value),
    };
  });
}

export default function FamilyCaregiverMonthlyReviewClient({ month }) {
  const monthDate = useMemo(() => monthFromSearchParam(month), [month]);
  const [caregiverHoursByDate, setCaregiverHoursByDate] = useState({});
  const [monthlySettingsByKey, setMonthlySettingsByKey] = useState({});
  const [fallbackHourlyWage, setFallbackHourlyWage] = useState(0);
  const [dailyBreakdownExpanded, setDailyBreakdownExpanded] = useState(false);

  useEffect(() => {
    setCaregiverHoursByDate(loadFamilyCaregiverHours());
    setMonthlySettingsByKey(loadFamilyCaregiverMonthlySettings());
    setFallbackHourlyWage(loadFamilyCaregiverHourlyWage());
  }, []);

  const reviewText = useMemo(
    () => buildReviewText(monthDate, caregiverHoursByDate),
    [caregiverHoursByDate, monthDate],
  );
  const summary = useMemo(
    () => summarizeMonth(monthDate, caregiverHoursByDate),
    [caregiverHoursByDate, monthDate],
  );
  const monthSetting = useMemo(
    () => resolveFamilyCaregiverMonthlySetting(
      monthlySettingsByKey,
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      fallbackHourlyWage,
    ),
    [fallbackHourlyWage, monthDate, monthlySettingsByKey],
  );
  const dailyBreakdown = useMemo(
    () => buildDailyBreakdown(monthDate, caregiverHoursByDate, monthSetting.hourlyWage),
    [caregiverHoursByDate, monthDate, monthSetting.hourlyWage],
  );
  const baseWage = summary.hours * monthSetting.hourlyWage;
  const totalWage = baseWage + summary.extras + monthSetting.transportFee;
  const monthParam = formatReviewMonthParam(monthDate);

  function updateMonthSetting(field, value) {
    const nextValue = normalizeFamilyCaregiverHourlyWage(value.replace(/[^\d]/g, ""));
    setMonthlySettingsByKey((current) => {
      const normalizedCurrent = normalizeFamilyCaregiverMonthlySettingsMap(current);
      const monthKey = formatReviewMonthParam(monthDate);
      const nextSetting = {
        ...monthSetting,
        [field]: nextValue,
      };
      const nextSettings = {
        ...normalizedCurrent,
        [monthKey]: nextSetting,
      };
      saveFamilyCaregiverMonthlySettings(nextSettings);
      return nextSettings;
    });
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
      <section className="familyCaregiverReviewSummary" aria-label="돌봄 보수 요약">
        <div>
          <span>총 돌봄 시간</span>
          <strong>{summary.days}일 / {formatTotalHours(summary.hours)}시간</strong>
        </div>
        <label>
          <span>시급</span>
          <span className="familyCaregiverWageField">
            <input
              aria-label="시급"
              inputMode="numeric"
              onChange={(event) => updateMonthSetting("hourlyWage", event.target.value)}
              type="text"
              value={monthSetting.hourlyWage.toLocaleString("ko-KR")}
            />
            원
          </span>
        </label>
        <div>
          <span>기본 급여</span>
          <strong>{formatWon(baseWage)}</strong>
        </div>
        <div>
          <span>추가 요금 합계</span>
          <strong>{formatWon(summary.extras)}</strong>
        </div>
        <label>
          <span>교통비</span>
          <span className="familyCaregiverWageField">
            <input
              aria-label="교통비"
              inputMode="numeric"
              onChange={(event) => updateMonthSetting("transportFee", event.target.value)}
              type="text"
              value={monthSetting.transportFee.toLocaleString("ko-KR")}
            />
            원
          </span>
        </label>
        <div>
          <span>총 지급액</span>
          <strong>{formatWon(totalWage)}</strong>
        </div>
      </section>
      <button
        aria-expanded={dailyBreakdownExpanded}
        className="familyCaregiverDailyBreakdownToggle"
        type="button"
        onClick={() => setDailyBreakdownExpanded((current) => !current)}
      >
        {formatReviewMonth(monthDate)} 자세히 보기
      </button>
      {dailyBreakdownExpanded ? (
        <>
          <pre className="caregiverMonthlyReviewText">{reviewText}</pre>
          <section className="familyCaregiverDailyBreakdown" aria-label="일별 돌봄 내역">
            <div className="familyCaregiverDailyBreakdownHeader">
              <span>날짜</span>
              <span>요일</span>
              <span>돌봄 시간</span>
              <span>기본 급여</span>
              <span>추가 요금</span>
              <span>비고</span>
            </div>
            {dailyBreakdown.map((day) => (
              <div className="familyCaregiverDailyBreakdownRow" key={`${monthParam}-${day.dateLabel}`}>
                <span>{day.dateLabel}</span>
                <span>{day.weekday}</span>
                <span>{formatFamilyCaregiverHours(day.hours) || "0"}시간</span>
                <span>{formatWon(day.basePay)}</span>
                <span>{formatWon(day.extras)}</span>
                <span>{day.notes}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

export {
  buildReviewText,
  buildReviewWeeks,
  buildDailyBreakdown,
  fixedDisplayWidth,
  formatDailyExtraNotes,
  formatReviewMonth,
  formatWon,
  summarizeMonth,
};
