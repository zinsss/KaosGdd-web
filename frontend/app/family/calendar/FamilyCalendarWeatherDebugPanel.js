"use client";

function formatDebugJson(value) {
  return JSON.stringify(value, null, 2);
}

const FAMILY_WEATHER_DEBUG_SECTIONS = [
  {
    key: "selectedWeekDailyWeatherItems",
    label: "선택한 주 일별 날씨",
  },
  {
    key: "selectedWeekDaypartWeatherItems",
    label: "선택한 주 시간대별 날씨",
  },
  {
    key: "weatherByDate",
    label: "weatherByDate",
  },
  {
    key: "weatherDaypartsByDate",
    label: "weatherDaypartsByDate",
  },
];

export default function FamilyCalendarWeatherDebugPanel({ debugData }) {
  return (
    <aside className="familyCalendarWeatherDebug" aria-label="임시 날씨 디버그">
      <p className="familyCalendarWeatherDebugTitle">임시 날씨 디버그</p>
      <div className="familyCalendarWeatherDebugSections">
        {FAMILY_WEATHER_DEBUG_SECTIONS.map((section) => (
          <section className="familyCalendarWeatherDebugSection" key={section.key}>
            <h3 className="familyCalendarWeatherDebugHeading">{section.label}</h3>
            <pre className="familyCalendarWeatherDebugPre">{formatDebugJson(debugData?.[section.key] ?? null)}</pre>
          </section>
        ))}
      </div>
    </aside>
  );
}
