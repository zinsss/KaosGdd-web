export const ANALOGUE_INITIAL_STATE = {
  speed: 0,
  rpm: 0,
  fuel: 70,
  temp: 45,
  leftIndicator: false,
  rightIndicator: false,
  tyrePressure: false,
  engineWarning: false,
};

export function clampAnalogueValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function setAnalogueLevel(state, key, value) {
  if (key === "speed") return { ...state, speed: clampAnalogueValue(Math.round(value / 5) * 5, 0, 220) };
  if (key === "rpm") return { ...state, rpm: clampAnalogueValue(Math.round(value / 100) * 100, 0, 8000) };
  if (key === "fuel") return { ...state, fuel: clampAnalogueValue(Math.round(value / 5) * 5, 0, 100) };
  if (key === "temp") return { ...state, temp: clampAnalogueValue(Math.round(value / 5) * 5, 0, 100) };
  return state;
}

export function changeAnalogueLevel(state, key, delta) {
  return setAnalogueLevel(state, key, Number(state[key]) + delta);
}

export function toggleAnalogueIndicator(state, side) {
  if (side === "left") {
    return { ...state, leftIndicator: !state.leftIndicator, rightIndicator: false };
  }
  return { ...state, rightIndicator: !state.rightIndicator, leftIndicator: false };
}

export function toggleAnalogueWarning(state, key) {
  if (key !== "tyrePressure" && key !== "engineWarning") return state;
  return { ...state, [key]: !state[key] };
}

export function resetAnalogueDashboard() {
  return { ...ANALOGUE_INITIAL_STATE };
}

export function reduceAnalogueShortcut(state, eventLike) {
  const key = String(eventLike?.key || "");
  if (key === "ArrowLeft") return toggleAnalogueIndicator(state, "left");
  if (key === "ArrowRight") return toggleAnalogueIndicator(state, "right");
  if (key === "ArrowUp") return changeAnalogueLevel(state, "speed", 5);
  if (key === "ArrowDown") return changeAnalogueLevel(state, "speed", -5);
  if (key.toUpperCase() === "R") return changeAnalogueLevel(state, "rpm", eventLike?.shiftKey ? -500 : 500);
  if (key.toUpperCase() === "F") return changeAnalogueLevel(state, "fuel", eventLike?.shiftKey ? 5 : -5);
  if (key.toUpperCase() === "T") return changeAnalogueLevel(state, "temp", eventLike?.shiftKey ? -5 : 5);
  if (key.toUpperCase() === "P") return toggleAnalogueWarning(state, "tyrePressure");
  if (key.toUpperCase() === "E") return toggleAnalogueWarning(state, "engineWarning");
  if (key === "Escape") return resetAnalogueDashboard();
  return state;
}
