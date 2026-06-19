import { FAMILY_CALENDAR_DAYPART_LABELS, formatFamilyWeatherLabel } from "../../lib/weather-client";

const FAMILY_CALENDAR_DAYPART_RAIL_LABELS = ["M", "A", "E", "N"];

function formatWeatherRange(item) {
  if (!item) return "";
  if (item.min_c === "" || item.max_c === "" || item.min_c === undefined || item.max_c === undefined) {
    return "";
  }
  return `${item.min_c}-${item.max_c}`;
}

function formatDaypartRange(item) {
  if (!item) return "";
  if (item.temp_min_c === "" || item.temp_max_c === "" || item.temp_min_c === undefined || item.temp_max_c === undefined) {
    return "";
  }
  return `${item.temp_min_c}-${item.temp_max_c}`;
}

function formatWeatherText(label, range) {
  if (!label) return range || "";
  if (!range) return label;
  return `${label} ${range}`;
}

function hasDaypartWeather(item) {
  if (!item) return false;
  return item.temp_min_c !== "" || item.temp_max_c !== "";
}

function dailyWeatherDisplay(weather) {
  return weather?.weatherLabel || formatFamilyWeatherLabel(
    weather?.glyph,
    weather?.condition || weather?.summary || weather?.label,
    weather?.weather_code,
  );
}

function WeatherCell({ children, className = "" }) {
  return <div className={`familyCalendarDaySlot familyCalendarWeatherSlot${className ? ` ${className}` : ""}`}>{children}</div>;
}

export default function FamilyCalendarWeatherRows({ expanded = false, onToggle = null, selectedWeekDates, weatherByDate, weatherDaypartsByDate }) {
  return (
    <>
      <div className="familyCalendarTimeRow familyCalendarWeatherRow familyCalendarWeatherSummaryRow">
        {onToggle ? (
          <button
            aria-expanded={expanded}
            aria-label="날씨 자세히 보기"
            className="familyCalendarWeatherToggle"
            onClick={onToggle}
            type="button"
          >
            <span className="familyCalendarWeatherToggleLabel">•</span>
          </button>
        ) : (
          <span className="familyCalendarTimeLabel familyCalendarWeatherLabel">•</span>
        )}
        {selectedWeekDates.map((date) => {
          const weather = weatherByDate.get(date);
          const weatherLabel = dailyWeatherDisplay(weather);
          return (
            <WeatherCell key={`summary-${date}`}>
              {weather ? (
                <span className="familyCalendarWeatherSummary familyCalendarWeatherLabelText">
                  {formatWeatherText(weatherLabel, formatWeatherRange(weather))}
                </span>
              ) : null}
            </WeatherCell>
          );
        })}
      </div>
      {expanded ? FAMILY_CALENDAR_DAYPART_LABELS.map((defaultLabel, index) => (
        <div className="familyCalendarTimeRow familyCalendarWeatherRow" key={defaultLabel}>
          <span className="familyCalendarTimeLabel familyCalendarWeatherLabel">{FAMILY_CALENDAR_DAYPART_RAIL_LABELS[index]}</span>
          {selectedWeekDates.map((date) => {
            const weather = weatherDaypartsByDate[date]?.[index];
            const dailyWeather = weatherByDate.get(date);
            const weatherLabel = dailyWeatherDisplay(dailyWeather);
            return (
              <WeatherCell key={`${defaultLabel}-${date}`}>
                {hasDaypartWeather(weather) ? (
                  <span className="familyCalendarWeatherDaypart familyCalendarWeatherLabelText">
                    {formatWeatherText(weatherLabel, formatDaypartRange(weather))}
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
