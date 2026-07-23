"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  IONIQ_GEARS,
  IONIQ_INITIAL_STATE,
  batteryRangeKm,
  batteryStatus,
  changeIoniqBattery,
  changeIoniqSpeed,
  cycleIoniqGear,
  reduceIoniqShortcut,
  resetIoniqDashboard,
  selectIoniqGear,
  stopIoniqSpeed,
  toggleIoniqHazard,
  toggleIoniqHeadlights,
  toggleIoniqSignal,
} from "./ioniqDashboardState";

const SOUND_PREF_KEY = "kaosgdd.family.ioniqDashboard.soundEnabled.v1";
const AUTOPLAY_PREF_KEY = "kaosgdd.family.ioniqDashboard.autoPlay.v1";

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or kiosk contexts.
  }
}

function useIoniqAudio(soundEnabled) {
  const audioContextRef = useRef(null);
  const tickIntervalRef = useRef(null);

  const ensureAudio = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, [soundEnabled]);

  const playTone = useCallback(
    ({ frequency = 440, duration = 0.08, type = "sine", gain = 0.035, bendTo = null } = {}) => {
      const audioContext = ensureAudio();
      if (!audioContext) return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (bendTo) oscillator.frequency.exponentialRampToValueAtTime(bendTo, now + duration);
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    },
    [ensureAudio],
  );

  const playClick = useCallback(() => playTone({ frequency: 620, duration: 0.045, type: "triangle", gain: 0.025 }), [playTone]);
  const playGear = useCallback(() => playTone({ frequency: 520, duration: 0.12, type: "sine", gain: 0.04, bendTo: 780 }), [playTone]);
  const playTick = useCallback(() => playTone({ frequency: 760, duration: 0.055, type: "square", gain: 0.018 }), [playTone]);
  const playBatteryWarning = useCallback(() => playTone({ frequency: 280, duration: 0.14, type: "sawtooth", gain: 0.028, bendTo: 210 }), [playTone]);
  const playHorn = useCallback(() => {
    playTone({ frequency: 220, duration: 0.16, type: "sawtooth", gain: 0.055 });
    window.setTimeout(() => playTone({ frequency: 185, duration: 0.13, type: "sawtooth", gain: 0.045 }), 90);
  }, [playTone]);

  const setTicking = useCallback(
    (active) => {
      if (tickIntervalRef.current) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      if (!active || !soundEnabled) return;
      playTick();
      tickIntervalRef.current = window.setInterval(playTick, 760);
    },
    [playTick, soundEnabled],
  );

  useEffect(() => {
    if (!soundEnabled && tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current);
    };
  }, []);

  return { ensureAudio, playClick, playGear, playTick, playBatteryWarning, playHorn, setTicking };
}

function CameraRoad({ side, active, speed, headlights }) {
  const duration = `${Math.max(0.45, 2.8 - speed / 55)}s`;
  return (
    <div
      className={`ioniqCamera ioniqCamera${side === "left" ? "Left" : "Right"}${active ? " ioniqCameraActive" : ""}`}
      style={{ "--ioniq-road-speed": duration }}
      aria-label={`${side === "left" ? "왼쪽" : "오른쪽"} 사이드 카메라`}
    >
      <div className="ioniqCameraLens">
        <div className="ioniqCameraSky" />
        <div className={`ioniqCameraRoad${headlights ? " ioniqCameraRoadLit" : ""}`}>
          <span className="ioniqCameraCarEdge" />
          <span className="ioniqCameraLaneLine" />
          <span className="ioniqCameraLaneLine ioniqCameraLaneLineSecond" />
          <span className="ioniqFollowingCar" />
        </div>
      </div>
      <span className="ioniqCameraLabel">{active ? `${side === "left" ? "왼쪽" : "오른쪽"} 카메라` : "대기"}</span>
    </div>
  );
}

function GearButton({ gear, active, onPress }) {
  return (
    <button
      className={`ioniqGearButton${active ? " ioniqGearButtonActive" : ""}`}
      type="button"
      aria-pressed={active}
      aria-label={`${gear} 기어 선택`}
      onClick={() => onPress(gear)}
    >
      {gear}
    </button>
  );
}

function ControlButton({ children, className = "", disabled = false, onClick, pressed = undefined, ariaLabel = "" }) {
  return (
    <button
      className={`ioniqControlButton${pressed ? " ioniqControlButtonActive" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel || (typeof children === "string" ? children : undefined)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function IoniqDashboardClient() {
  const [dashboardState, setDashboardState] = useState(IONIQ_INITIAL_STATE);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [hornPulse, setHornPulse] = useState(false);
  const [gearPulse, setGearPulse] = useState(false);
  const autoStepRef = useRef(0);
  const { ensureAudio, playClick, playGear, playBatteryWarning, playHorn, setTicking } = useIoniqAudio(dashboardState.soundEnabled);

  useEffect(() => {
    const soundPref = safeLocalStorageGet(SOUND_PREF_KEY);
    const autoPref = safeLocalStorageGet(AUTOPLAY_PREF_KEY);
    setDashboardState((current) => ({
      ...current,
      soundEnabled: soundPref == null ? current.soundEnabled : soundPref === "true",
      autoPlay: autoPref === "true",
    }));
  }, []);

  useEffect(() => {
    safeLocalStorageSet(SOUND_PREF_KEY, String(dashboardState.soundEnabled));
  }, [dashboardState.soundEnabled]);

  useEffect(() => {
    safeLocalStorageSet(AUTOPLAY_PREF_KEY, String(dashboardState.autoPlay));
  }, [dashboardState.autoPlay]);

  const activeLeft = dashboardState.hazard || dashboardState.leftSignal;
  const activeRight = dashboardState.hazard || dashboardState.rightSignal;

  useEffect(() => {
    setTicking(activeLeft || activeRight);
  }, [activeLeft, activeRight, setTicking]);

  useEffect(() => {
    setFullscreenSupported(Boolean(document.fullscreenEnabled && document.documentElement?.requestFullscreen));

    function handleFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const runAction = useCallback(
    (updater, sound = "click", mainControl = true) => {
      ensureAudio();
      setDashboardState((current) => updater(mainControl ? { ...current, autoPlay: false } : current));
      if (sound === "gear") {
        playGear();
        setGearPulse(true);
        window.setTimeout(() => setGearPulse(false), 220);
      } else if (sound === "warning") {
        playBatteryWarning();
      } else if (sound === "none") {
        // No-op.
      } else {
        playClick();
      }
    },
    [ensureAudio, playBatteryWarning, playClick, playGear],
  );

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key;
      if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) event.preventDefault();
      const beforeBattery = dashboardState.battery;
      const beforeGear = dashboardState.gear;
      const shortcutState = reduceIoniqShortcut(dashboardState, event);
      if (shortcutState === dashboardState) return;
      const next = { ...shortcutState, autoPlay: false };
      setDashboardState(next);
      ensureAudio();
      if (next.gear !== beforeGear) {
        playGear();
        setGearPulse(true);
        window.setTimeout(() => setGearPulse(false), 220);
      } else if (next.battery <= 10 && next.battery < beforeBattery) {
        playBatteryWarning();
      } else {
        playClick();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dashboardState, ensureAudio, playBatteryWarning, playClick, playGear]);

  useEffect(() => {
    if (!dashboardState.autoPlay) return;
    const interval = window.setInterval(() => {
      setDashboardState((current) => {
        const step = autoStepRef.current % 8;
        autoStepRef.current += 1;
        if (step === 0) return selectIoniqGear(current, "D");
        if (step === 1) return changeIoniqSpeed(current, 20);
        if (step === 2) return toggleIoniqSignal(current, "left");
        if (step === 3) return toggleIoniqSignal(current, "right");
        if (step === 4) return toggleIoniqHeadlights(current);
        if (step === 5) return changeIoniqBattery(current, -10);
        if (step === 6) return toggleIoniqHazard(current);
        return { ...toggleIoniqHazard(stopIoniqSpeed(current)), autoPlay: true };
      });
    }, 1800);
    return () => window.clearInterval(interval);
  }, [dashboardState.autoPlay]);

  const batteryMeta = useMemo(() => batteryStatus(dashboardState.battery), [dashboardState.battery]);
  const rangeKm = batteryRangeKm(dashboardState.battery);
  const roadDuration = `${Math.max(0.55, 3.2 - dashboardState.speed / 46)}s`;
  const powerPercent = dashboardState.gear === "D" ? Math.round((dashboardState.speed / 120) * 100) : 0;
  const readyText = dashboardState.battery <= 0 ? "충전 필요" : dashboardState.gear === "P" ? "READY" : "주행 준비";
  const modeText = dashboardState.gear === "R" ? "후진 보기" : dashboardState.gear === "D" ? "ECO DRIVE" : dashboardState.gear === "N" ? "중립" : "주차";

  function changeBattery(delta) {
    runAction((current) => changeIoniqBattery(current, delta), dashboardState.battery + delta <= 10 ? "warning" : "click");
  }

  function requestFullscreen() {
    if (!fullscreenSupported) return;
    runAction((current) => current, "click", false);
    const element = document.querySelector(".ioniqDashboardPage");
    if (!document.fullscreenElement && element?.requestFullscreen) {
      element.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function honk() {
    ensureAudio();
    playHorn();
    setHornPulse(true);
    setDashboardState((current) => ({ ...current, autoPlay: false }));
    window.setTimeout(() => setHornPulse(false), 260);
  }

  return (
    <section className="ioniqDashboardPage" aria-label="아이오닉 5 계기판 놀이">
      <main className="ioniqClusterShell" style={{ "--ioniq-lane-speed": roadDuration }}>
        <section className="ioniqClusterPanel ioniqClusterPanelLeft" aria-label="왼쪽 정보">
          <button
            className={`ioniqSignalButton ioniqSignalLeft${activeLeft ? " ioniqSignalActive" : ""}`}
            type="button"
            aria-pressed={activeLeft}
            aria-label="왼쪽 깜빡이"
            onClick={() => runAction((current) => toggleIoniqSignal(current, "left"))}
          >
            ←
            <span>{activeLeft ? "왼쪽 켜짐" : "왼쪽"}</span>
          </button>
          <CameraRoad side="left" active={activeLeft || dashboardState.gear === "R"} speed={dashboardState.speed} headlights={dashboardState.headlights} />

          <button className={`ioniqBatteryCard ioniqBattery${batteryMeta.tone}`} type="button" onClick={() => changeBattery(-10)} aria-label="배터리 10퍼센트 줄이기">
            <span className="ioniqSmallLabel">배터리</span>
            <span className="ioniqBatteryBar">
              <span style={{ width: `${dashboardState.battery}%` }} />
            </span>
            <strong>{dashboardState.battery}%</strong>
            <span>{rangeKm} km</span>
          </button>
          <div className="ioniqReadyStatus">
            <span className={dashboardState.battery <= 0 ? "ioniqWarningText" : ""}>{readyText}</span>
            {batteryMeta.message ? <strong>{batteryMeta.message}</strong> : <em>정상</em>}
          </div>
        </section>

        <section className={`ioniqClusterPanel ioniqCenterPanel${dashboardState.gear === "R" ? " ioniqReverseMode" : ""}`} aria-label="중앙 계기판">
          <button
            className={`ioniqGearDisplay${gearPulse ? " ioniqGearPulse" : ""}`}
            type="button"
            aria-label="기어 순서 바꾸기"
            onClick={() => runAction(cycleIoniqGear, "gear")}
          >
            {dashboardState.gear}
          </button>
          <div className="ioniqSpeedReadout" aria-live="polite">
            <strong>{dashboardState.speed}</strong>
            <span>km/h</span>
          </div>
          <div className={`ioniqRoadScene${dashboardState.headlights ? " ioniqRoadSceneLit" : ""}`}>
            <div className="ioniqLane ioniqLaneLeft" />
            <div className="ioniqLane ioniqLaneRight" />
            {dashboardState.gear === "R" ? (
              <div className="ioniqReverseGrid" aria-label="후진 가이드">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <div className={`ioniqVehicle${hornPulse ? " ioniqVehicleHorn" : ""}`} aria-hidden="true">
              <span className="ioniqVehicleCabin" />
              <span className="ioniqVehicleBody" />
              <span className="ioniqVehicleLight ioniqVehicleLightLeft" />
              <span className="ioniqVehicleLight ioniqVehicleLightRight" />
            </div>
          </div>
          <div className="ioniqIconRow" aria-label="상태 표시">
            <span className={dashboardState.headlights ? "ioniqIconActive" : ""}>전조등 {dashboardState.headlights ? "켜짐" : "꺼짐"}</span>
            <span className={dashboardState.hazard ? "ioniqIconDanger" : ""}>비상등 {dashboardState.hazard ? "켜짐" : "꺼짐"}</span>
            <span className={dashboardState.battery <= 10 ? "ioniqIconDanger" : ""}>배터리 {batteryMeta.message || "정상"}</span>
          </div>
        </section>

        <section className="ioniqClusterPanel ioniqClusterPanelRight" aria-label="오른쪽 정보">
          <button
            className={`ioniqSignalButton ioniqSignalRight${activeRight ? " ioniqSignalActive" : ""}`}
            type="button"
            aria-pressed={activeRight}
            aria-label="오른쪽 깜빡이"
            onClick={() => runAction((current) => toggleIoniqSignal(current, "right"))}
          >
            →
            <span>{activeRight ? "오른쪽 켜짐" : "오른쪽"}</span>
          </button>
          <CameraRoad side="right" active={activeRight || dashboardState.gear === "R"} speed={dashboardState.speed} headlights={dashboardState.headlights} />

          <div className="ioniqPowerCard">
            <span className="ioniqSmallLabel">파워</span>
            <div className="ioniqPowerGauge">
              <span style={{ height: `${powerPercent}%` }} />
            </div>
            <strong>{powerPercent}%</strong>
            <span>ODO 005032</span>
          </div>
          <div className="ioniqModeCard">
            <span>{modeText}</span>
            <strong>{dashboardState.gear === "D" ? "부드럽게 출발" : "멈춤"}</strong>
          </div>
        </section>
      </main>

      <section className="ioniqControls" aria-label="계기판 조작">
        <div className="ioniqGearControls" aria-label="기어 선택">
          {IONIQ_GEARS.map((gear) => (
            <GearButton key={gear} gear={gear} active={dashboardState.gear === gear} onPress={(nextGear) => runAction((current) => selectIoniqGear(current, nextGear), "gear")} />
          ))}
        </div>

        <div className="ioniqControlGrid">
          <ControlButton onClick={() => runAction((current) => changeIoniqSpeed(current, 10))}>속도 +</ControlButton>
          <ControlButton onClick={() => runAction((current) => changeIoniqSpeed(current, -10))}>속도 −</ControlButton>
          <ControlButton onClick={() => runAction(stopIoniqSpeed)}>정지</ControlButton>
          <ControlButton onClick={() => changeBattery(10)}>배터리 +</ControlButton>
          <ControlButton onClick={() => changeBattery(-10)}>배터리 −</ControlButton>
          <ControlButton className="ioniqHazardButton" pressed={dashboardState.hazard} ariaLabel="비상등" onClick={() => runAction(toggleIoniqHazard)}>
            ▲ 비상등
          </ControlButton>
          <ControlButton pressed={dashboardState.headlights} onClick={() => runAction(toggleIoniqHeadlights)}>
            전조등
          </ControlButton>
          <ControlButton className="ioniqHornButton" onClick={honk}>
            빵빵
          </ControlButton>
          <ControlButton onClick={() => runAction(resetIoniqDashboard)}>처음으로</ControlButton>
          <ControlButton
            pressed={dashboardState.soundEnabled}
            onClick={() =>
              setDashboardState((current) => ({
                ...current,
                soundEnabled: !current.soundEnabled,
                autoPlay: false,
              }))
            }
          >
            {dashboardState.soundEnabled ? "소리 켜짐" : "소리 꺼짐"}
          </ControlButton>
          <ControlButton
            pressed={dashboardState.autoPlay}
            onClick={() => {
              ensureAudio();
              playClick();
              setDashboardState((current) => ({ ...current, autoPlay: !current.autoPlay }));
            }}
          >
            자동 놀이
          </ControlButton>
          <ControlButton disabled={!fullscreenSupported} onClick={requestFullscreen}>
            {fullscreenSupported ? (fullscreen ? "화면 나가기" : "전체 화면") : "전체 화면 불가"}
          </ControlButton>
        </div>
      </section>
    </section>
  );
}
