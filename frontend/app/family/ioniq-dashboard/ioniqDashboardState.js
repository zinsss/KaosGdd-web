export const IONIQ_GEARS = ["P", "R", "N", "D"];

export const IONIQ_INITIAL_STATE = {
  gear: "P",
  speed: 0,
  battery: 100,
  leftSignal: false,
  rightSignal: false,
  hazard: false,
  headlights: false,
  soundEnabled: true,
  autoPlay: false,
};

export function clampIoniqValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function batteryRangeKm(battery) {
  return clampIoniqValue(Number(battery) || 0, 0, 100) * 5;
}

export function batteryStatus(battery) {
  const safeBattery = clampIoniqValue(Number(battery) || 0, 0, 100);
  if (safeBattery <= 0) return { tone: "red", message: "충전이 필요해요" };
  if (safeBattery <= 10) return { tone: "red", message: "배터리가 부족해요" };
  if (safeBattery <= 50) return { tone: "yellow", message: "" };
  return { tone: "blue", message: "" };
}

export function selectIoniqGear(state, gear) {
  const nextGear = IONIQ_GEARS.includes(gear) ? gear : state.gear;
  return {
    ...state,
    gear: nextGear,
    speed: nextGear === "D" ? state.speed : 0,
  };
}

export function cycleIoniqGear(state) {
  const currentIndex = IONIQ_GEARS.indexOf(state.gear);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % IONIQ_GEARS.length;
  return selectIoniqGear(state, IONIQ_GEARS[nextIndex]);
}

export function changeIoniqBattery(state, delta) {
  return {
    ...state,
    battery: clampIoniqValue(state.battery + delta, 0, 100),
  };
}

export function changeIoniqSpeed(state, delta) {
  if (state.gear !== "D") return { ...state, speed: 0 };
  return {
    ...state,
    speed: clampIoniqValue(state.speed + delta, 0, 120),
  };
}

export function stopIoniqSpeed(state) {
  return { ...state, speed: 0 };
}

export function toggleIoniqSignal(state, side) {
  if (state.hazard) {
    return {
      ...state,
      hazard: false,
      leftSignal: side === "left",
      rightSignal: side === "right",
    };
  }

  if (side === "left") {
    return {
      ...state,
      leftSignal: !state.leftSignal,
      rightSignal: false,
    };
  }

  return {
    ...state,
    rightSignal: !state.rightSignal,
    leftSignal: false,
  };
}

export function toggleIoniqHazard(state) {
  const nextHazard = !state.hazard;
  return {
    ...state,
    hazard: nextHazard,
    leftSignal: false,
    rightSignal: false,
  };
}

export function toggleIoniqHeadlights(state) {
  return {
    ...state,
    headlights: !state.headlights,
  };
}

export function resetIoniqDashboard(state = IONIQ_INITIAL_STATE) {
  return {
    ...IONIQ_INITIAL_STATE,
    soundEnabled: state.soundEnabled,
    autoPlay: false,
  };
}

export function reduceIoniqShortcut(state, eventLike) {
  const key = String(eventLike?.key || "");
  const shiftKey = Boolean(eventLike?.shiftKey);
  const upperKey = key.toUpperCase();

  if (IONIQ_GEARS.includes(upperKey)) return selectIoniqGear(state, upperKey);
  if (key === "ArrowLeft") return toggleIoniqSignal(state, "left");
  if (key === "ArrowRight") return toggleIoniqSignal(state, "right");
  if (key === "ArrowUp") return changeIoniqSpeed(state, 10);
  if (key === "ArrowDown") return changeIoniqSpeed(state, -10);
  if (key === " ") return toggleIoniqHazard(state);
  if (key === "0") return stopIoniqSpeed(state);
  if (upperKey === "H") return toggleIoniqHeadlights(state);
  if (upperKey === "B") return changeIoniqBattery(state, shiftKey ? 10 : -10);
  if (key === "Escape") return resetIoniqDashboard(state);

  return state;
}
