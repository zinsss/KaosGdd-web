"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_WEATHER_LOCATIONS,
  getStoredWeatherLocation,
  listenWeatherLocationChange,
  setStoredWeatherLocation,
} from "../../app/lib/weather-client";

export default function WeatherLocationSettings() {
  const [weatherLocation, setWeatherLocation] = useState(getStoredWeatherLocation);

  useEffect(() => listenWeatherLocationChange(setWeatherLocation), []);

  return (
    <select
      aria-label="날씨 지역"
      value={weatherLocation}
      onChange={(event) => setStoredWeatherLocation(event.target.value)}
    >
      {DEFAULT_WEATHER_LOCATIONS.map((location) => (
        <option key={location.id} value={location.id}>{location.label}</option>
      ))}
    </select>
  );
}
