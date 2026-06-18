import { FAMILY_CALENDAR_DAYPART_LABELS, formatFamilyWeatherGlyph } from "../../lib/weather-client";

function formatWeatherRange(item) {
  if (!item) return "";
  if (item.min_c === "" || item.max_c === "" || item.min_c === undefined || item.max_c === undefined) {
    return "";
  }
  return `${item.min_c}/${item.max_c}`;
}

function formatDaypartRange(item) {
  if (!item) return "";
  if (item.temp_min_c === "" || item.temp_max_c === "" || item.temp_min_c === undefined || item.temp_max_c === undefined) {
    return "";
  }
  return `${item.temp_min_c}°/${item.temp_max_c}°`;
}

function hasDaypartWeather(item) {
  if (!item) return false;
  return Boolean(item.glyph) || item.temp_min_c !== "" || item.temp_max_c !== "";
}

function WeatherCell({ children, className = "" }) {
  return <div className={`familyCalendarDaySlot familyCalendarWeatherSlot${className ? ` ${className}` : ""}`}>{children}</div>;
}

export default function FamilyCalendarWeatherRows({ expanded = false, onToggle = null, selectedWeekDates, weatherByDate, weatherDaypartsByDate }) {
  const toggleGlyph = expanded ? "▾" : "▸";

  return (
    <>
      <div className="familyCalendarTimeRow familyCalendarWeatherRow familyCalendarWeatherSummaryRow">
        {onToggle ? (
          <button
            aria-expanded={expanded}
            className="familyCalendarWeatherToggle"
            onClick={onToggle}
            type="button"
          >
            <span className="familyCalendarWeatherToggleLabel">날씨</span>
            <span aria-hidden="true" className="familyCalendarWeatherToggleGlyph">{toggleGlyph}</span>
          </button>
        ) : (
          <span className="familyCalendarTimeLabel familyCalendarWeatherLabel">날씨</span>
        )}
        {selectedWeekDates.map((date) => {
          const weather = weatherByDate.get(date);
          const glyph = formatFamilyWeatherGlyph(weather?.glyph);
          return (
            <WeatherCell key={`summary-${date}`}>
              {weather ? (
                <span className="familyCalendarWeatherSummary">
                  <span className="familyCalendarWeatherGlyph" aria-hidden="true">{glyph}</span>
                  <span className="familyCalendarWeatherTemp">{formatWeatherRange(weather)}</span>
                </span>
              ) : null}
            </WeatherCell>
          );
        })}
      </div>
      {expanded ? FAMILY_CALENDAR_DAYPART_LABELS.map((defaultLabel, index) => (
        <div className="familyCalendarTimeRow familyCalendarWeatherRow" key={defaultLabel}>
          <span className="familyCalendarTimeLabel familyCalendarWeatherLabel">{defaultLabel}</span>
          {selectedWeekDates.map((date) => {
            const weather = weatherDaypartsByDate[date]?.[index];
            return (
              <WeatherCell key={`${defaultLabel}-${date}`}>
                {hasDaypartWeather(weather) ? (
                  <span className="familyCalendarWeatherDaypart">
                    <span className="familyCalendarWeatherGlyph" aria-hidden="true">{weather.glyph}</span>
                    <span className="familyCalendarWeatherTemp">{formatDaypartRange(weather)}</span>
                  </span>
                ) : null}
              </WeatherCell>
            );
          })}
        </div>
      )) : null}
    </>
  );
}
