"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_WEATHER_LOCATIONS,
  fetchSharedWeather,
  getStoredWeatherLocation,
  listenWeatherLocationChange,
  normalizeWeatherLocations,
  setStoredWeatherLocation,
} from "../../app/lib/weather-client";

export default function WeatherLocationSettings() {
  const [weatherLocation, setWeatherLocation] = useState(getStoredWeatherLocation);
  const [weatherLocations, setWeatherLocations] = useState(DEFAULT_WEATHER_LOCATIONS);

  useEffect(() => listenWeatherLocationChange(setWeatherLocation), []);
  useEffect(() => {
    let cancelled = false;
    fetchSharedWeather()
      .then((data) => {
        if (!cancelled) setWeatherLocations(normalizeWeatherLocations(data?.locations));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <select
      aria-label="날씨 지역"
      value={weatherLocation}
      onChange={(event) => setStoredWeatherLocation(event.target.value)}
    >
      {weatherLocations.map((location) => (
        <option key={location.id} value={location.id}>{location.label}</option>
      ))}
    </select>
  );
}
