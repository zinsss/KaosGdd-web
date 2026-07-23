"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ANALOGUE_INITIAL_STATE,
  changeAnalogueLevel,
  reduceAnalogueShortcut,
  resetAnalogueDashboard,
  setAnalogueLevel,
  toggleAnalogueIndicator,
  toggleAnalogueWarning,
} from "./analogueDashboardState";

function gaugeAngle(value, max) {
  return -128 + (Math.max(0, Math.min(max, value)) / max) * 256;
}

function Gauge({ label, max, minLabel, maxLabel, unit, value, gaugeKey, onLevel }) {
  const ref = useRef(null);
  const angle = gaugeAngle(value, max);

  const updateFromPoint = useCallback(
    (clientX) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = (clientX - rect.left) / rect.width;
      onLevel(gaugeKey, Math.max(0, Math.min(max, ratio * max)));
    },
    [gaugeKey, max, onLevel],
  );

  function startLevelDrag(event) {
    updateFromPoint(event.clientX ?? event.touches?.[0]?.clientX ?? 0);
    const pointerId = event.pointerId;
    if (pointerId != null) ref.current?.setPointerCapture?.(pointerId);
  }

  return (
    <section
      className="analogueGauge"
      ref={ref}
      aria-label={`${label} 조절`}
      onPointerDown={startLevelDrag}
      onPointerMove={(event) => {
        if (event.buttons) updateFromPoint(event.clientX);
      }}
    >
      <div className="analogueGaugeArc">
        <span className="analogueTick analogueTickStart">{minLabel}</span>
        <span className="analogueTick analogueTickEnd">{maxLabel}</span>
        <span className="analogueNeedle" style={{ transform: `translateX(-50%) rotate(${angle}deg)` }} />
        <span className="analogueNeedleHub" />
      </div>
      <div className="analogueGaugeReadout">
        <strong>{value}</strong>
        <span>{unit}</span>
      </div>
      <h2>{label}</h2>
    </section>
  );
}

function DashboardSymbol({ active = false, label, tone = "amber", type }) {
  return (
    <span className={`analogueSymbol analogueSymbol${tone}${active ? " analogueSymbolActive" : ""}`} aria-label={label} title={label}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        {type === "engine" ? (
          <path d="M14 27h8v-6h13v6h7l5 6h5v14h-7l-5 6H22V41h-8V27Zm8 8h-4v2h4v-2Zm6-8v20h10l5-6h3v-2h-6l-5-6H28Z" />
        ) : null}
        {type === "tyre" ? (
          <>
            <path d="M18 12c-5 6-8 14-8 23 0 12 8 20 22 20s22-8 22-20c0-9-3-17-8-23l-6 5c4 5 6 11 6 18 0 8-5 12-14 12s-14-4-14-12c0-7 2-13 6-18l-6-5Z" />
            <path d="M30 20h4v18h-4V20Zm0 22h4v5h-4v-5Z" />
          </>
        ) : null}
        {type === "battery" ? (
          <path d="M8 22h42v6h6v16h-6v6H8V22Zm8 8v12h26V30H16Z" />
        ) : null}
        {type === "temp" ? (
          <>
            <path d="M29 8h6v28a12 12 0 1 1-6 0V8Zm3 34a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
            <path d="M42 16c6 0 6-4 12-4v6c-6 0-6 4-12 4v-6Zm0 12c6 0 6-4 12-4v6c-6 0-6 4-12 4v-6Z" />
          </>
        ) : null}
        {type === "oil" ? (
          <>
            <path d="M12 34h28l8 8-6 7H22l-10-9v-6Zm8-10 8 8h-9l-8-8h9Zm27 8 8-5 3 5-8 5-3-5Z" />
            <path d="M51 45c4 4 5 7 5 9a5 5 0 0 1-10 0c0-2 1-5 5-9Z" />
          </>
        ) : null}
        {type === "brake" ? (
          <>
            <path d="M32 11a21 21 0 1 0 0 42 21 21 0 0 0 0-42Zm0 8a13 13 0 1 1 0 26 13 13 0 0 1 0-26Z" />
            <path d="M29 21h7c6 0 10 3 10 8s-4 8-10 8h-3v8h-4V21Zm4 4v8h3c4 0 6-1 6-4s-2-4-6-4h-3ZM9 18h4v28H9V18Zm42 0h4v28h-4V18Z" />
          </>
        ) : null}
        {type === "fuel" ? (
          <>
            <path d="M14 10h24v44H14V10Zm7 8v12h10V18H21Zm20 1 9 9v18c0 3 4 3 4 0V30h-5v-8l-8-8v5Z" />
          </>
        ) : null}
        {type === "left" ? <path d="M8 32 34 12v13h22v14H34v13L8 32Z" /> : null}
        {type === "right" ? <path d="M56 32 30 12v13H8v14h22v13l26-20Z" /> : null}
      </svg>
      <em>{label}</em>
    </span>
  );
}

function SmallGauge({ label, value, kind, onLevel }) {
  const ref = useRef(null);
  const angle = -100 + (value / 100) * 200;

  function updateFromPoint(clientX) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onLevel(kind, ((clientX - rect.left) / rect.width) * 100);
  }

  return (
    <button
      className={`analogueSmallGauge analogueSmallGauge${kind}`}
      type="button"
      ref={ref}
      aria-label={`${label} 조절`}
      onClick={(event) => updateFromPoint(event.clientX)}
      onPointerMove={(event) => {
        if (event.buttons) updateFromPoint(event.clientX);
      }}
    >
      <span className="analogueSmallNeedle" style={{ transform: `translateX(-50%) rotate(${angle}deg)` }} />
      <strong>{label}</strong>
      <em>{value}%</em>
    </button>
  );
}

function ToggleButton({ active, children, className = "", onClick }) {
  return (
    <button className={`analogueToggle${active ? " analogueToggleActive" : ""}${className ? ` ${className}` : ""}`} type="button" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function SymbolToggle({ active, label, onClick, tone, type }) {
  return (
    <button className={`analogueSymbolToggle${active ? " analogueSymbolToggleActive" : ""}`} type="button" aria-pressed={active} aria-label={label} onClick={onClick}>
      <DashboardSymbol active={active} label={label} tone={tone} type={type} />
    </button>
  );
}

export default function AnalogueDashboardClient() {
  const [state, setState] = useState(ANALOGUE_INITIAL_STATE);

  useEffect(() => {
    function handleKeyDown(event) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault();
      setState((current) => reduceAnalogueShortcut(current, event));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function setLevel(key, value) {
    setState((current) => setAnalogueLevel(current, key, value));
  }

  return (
    <section className="analogueDashboardPage" aria-label="아날로그 계기판 놀이">
      <main className="analogueCluster">
        <div className="analogueIndicatorRow" aria-label="방향지시등">
          <ToggleButton active={state.leftIndicator} className="analogueIndicatorButton" onClick={() => setState((current) => toggleAnalogueIndicator(current, "left"))}>
            <DashboardSymbol active={state.leftIndicator} label="왼쪽" tone="green" type="left" />
          </ToggleButton>
          <div className="analogueCenterBadge">
            <span>아날로그 계기판</span>
            <strong>{state.speed} km/h</strong>
          </div>
          <ToggleButton active={state.rightIndicator} className="analogueIndicatorButton" onClick={() => setState((current) => toggleAnalogueIndicator(current, "right"))}>
            <DashboardSymbol active={state.rightIndicator} label="오른쪽" tone="green" type="right" />
          </ToggleButton>
        </div>

        <div className="analogueMainGauges">
          <Gauge label="RPM" max={8000} minLabel="0" maxLabel="8" unit="rpm" value={state.rpm} gaugeKey="rpm" onLevel={setLevel} />
          <Gauge label="KPH" max={220} minLabel="0" maxLabel="220" unit="km/h" value={state.speed} gaugeKey="speed" onLevel={setLevel} />
        </div>

        <div className="analogueSmallGaugeRow">
          <SmallGauge label="연료" value={state.fuel} kind="fuel" onLevel={setLevel} />
          <SmallGauge label="엔진 온도" value={state.temp} kind="temp" onLevel={setLevel} />
        </div>

        <div className="analogueSymbolStrip" aria-label="표준 계기판 경고등">
          <DashboardSymbol active={state.fuel <= 15} label="연료 부족" tone="amber" type="fuel" />
          <DashboardSymbol active={state.temp >= 80} label="온도 경고" tone="red" type="temp" />
          <DashboardSymbol active={false} label="배터리" tone="red" type="battery" />
          <DashboardSymbol active={false} label="오일" tone="red" type="oil" />
          <DashboardSymbol active={false} label="주차 브레이크" tone="red" type="brake" />
          <DashboardSymbol active={state.tyrePressure} label="타이어 압력" tone="amber" type="tyre" />
          <DashboardSymbol active={state.engineWarning} label="엔진 경고" tone="amber" type="engine" />
        </div>

        <div className="analogueWarningRow" aria-label="경고등 토글">
          <SymbolToggle active={state.tyrePressure} label="타이어 압력" tone="amber" type="tyre" onClick={() => setState((current) => toggleAnalogueWarning(current, "tyrePressure"))} />
          <SymbolToggle active={state.engineWarning} label="엔진 경고" tone="amber" type="engine" onClick={() => setState((current) => toggleAnalogueWarning(current, "engineWarning"))} />
        </div>
      </main>

      <section className="analogueControls" aria-label="계기판 조작">
        <button type="button" onClick={() => setState((current) => changeAnalogueLevel(current, "speed", 5))}>속도 +</button>
        <button type="button" onClick={() => setState((current) => changeAnalogueLevel(current, "speed", -5))}>속도 −</button>
        <button type="button" onClick={() => setState((current) => changeAnalogueLevel(current, "rpm", 500))}>RPM +</button>
        <button type="button" onClick={() => setState((current) => changeAnalogueLevel(current, "rpm", -500))}>RPM −</button>
        <button type="button" onClick={() => setState(resetAnalogueDashboard())}>처음으로</button>
      </section>
    </section>
  );
}
