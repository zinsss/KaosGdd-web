"use client";

import { useEffect, useMemo, useState } from "react";
import { UI_STRINGS } from "../lib/strings";
import { captureCreatedEventHasType } from "../lib/post-create-navigation";

const SUPPLY_MODES = ["active", "done"];

function buildSupplyModeHref(mode) {
  return mode === "active" ? "/supplies" : `/supplies?mode=${mode}`;
}

function supplyModeLabel(mode) {
  return mode === "done" ? "Done" : "Active";
}

function doneDateKey(item) {
  return String(item.done_date_key || "").trim() || "unknown";
}

function groupDoneByDate(items) {
  const groups = new Map();
  for (const item of items) {
    const key = doneDateKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function SuppliesPageClient({ initialMode }) {
  const mode = SUPPLY_MODES.includes(initialMode) ? initialMode : "active";

  const [items, setItems] = useState([]);
  const [presets, setPresets] = useState([]);
  const [localError, setLocalError] = useState("");

  function loadSupplies() {
    const suffix = mode === "active" ? "" : `?mode=${encodeURIComponent(mode)}`;
    setLocalError("");

    fetch(`/api/supplies${suffix}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || UI_STRINGS.LOAD_SUPPLIES_FAILED);
        setItems(data.items || []);
      })
      .catch((err) => {
        setItems([]);
        setLocalError(err?.message || UI_STRINGS.LOAD_SUPPLIES_FAILED);
      });
  }

  useEffect(() => {
    loadSupplies();
  }, [mode]);

  useEffect(() => {
    function onCaptureCreated(event) {
      if (!captureCreatedEventHasType(event, "supply")) return;
      loadSupplies();
    }

    window.addEventListener("kaosgdd:capture-created", onCaptureCreated);
    return () => window.removeEventListener("kaosgdd:capture-created", onCaptureCreated);
  }, [mode]);

  useEffect(() => {
    if (mode !== "active") return;

    fetch("/api/supplies/presets")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || UI_STRINGS.LOAD_PRESETS_FAILED);
        setPresets(data.items || []);
      })
      .catch(() => {
        setPresets([]);
      });
  }, [mode, items.length]);

  async function markDone(supplyId) {
    const res = await fetch(`/api/supplies/${supplyId}/done`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setLocalError((data && data.error) || UI_STRINGS.ACTION_FAILED);
      return;
    }
    setLocalError("");
    setItems((current) => current.filter((item) => item.id !== supplyId));
  }

  async function markActive(supplyId) {
    if (!window.confirm("Move this supply back to Active?")) return;
    const res = await fetch(`/api/supplies/${supplyId}/active`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setLocalError((data && data.error) || UI_STRINGS.ACTION_FAILED);
      return;
    }
    setLocalError("");
    setItems((current) => current.filter((item) => item.id !== supplyId));
  }

  async function hardDelete(supplyId) {
    const res = await fetch(`/api/supplies/${supplyId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setLocalError((data && data.error) || UI_STRINGS.ACTION_FAILED);
      return;
    }
    setLocalError("");
    setItems((current) => current.filter((item) => item.id !== supplyId));
  }

  async function usePreset(name) {
    const res = await fetch("/api/supplies/presets/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setLocalError((data && data.error) || UI_STRINGS.ACTION_FAILED);
      return;
    }

    const [activeRes, presetRes] = await Promise.all([
      fetch("/api/supplies"),
      fetch("/api/supplies/presets"),
    ]);
    const activeData = await activeRes.json().catch(() => ({ items: [] }));
    const presetData = await presetRes.json().catch(() => ({ items: [] }));
    setLocalError("");
    setItems(activeData.items || []);
    setPresets(presetData.items || []);
  }

  const doneGroups = useMemo(() => (mode === "done" ? groupDoneByDate(items || []) : []), [items, mode]);

  return (
    <main className="page">
      <section className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle sectionTitleNoMargin">
            <span className="sectionModuleName">{UI_STRINGS.SUPPLIES}</span>
            <span className="sectionSeparator"> • </span>
            <span className={mode === "active" ? "sectionContextActive" : "sectionContextDone"}>
              {mode === "active" ? "Active" : "Done"}
            </span>
          </div>
          <nav className="modeTextLinks" aria-label="Supplies mode">
            {SUPPLY_MODES.map((dotMode) => (
              <a
                key={dotMode}
                href={buildSupplyModeHref(dotMode)}
                className={"modeTextLink" + (mode === dotMode ? " modeTextLinkActive" : "")}
                aria-label={`Show ${dotMode} supplies`}
              >
                {supplyModeLabel(dotMode)}
              </a>
            ))}
          </nav>
        </div>

        {localError ? <div className="errorText">{localError}</div> : null}
        {mode === "active" ? (
          <>
            {items.length === 0 ? <div className="empty">No supplies queued.</div> : null}
            <ul className="taskList">
              {items.map((item) => (
                <li key={item.id} className="taskListRow supplyRow" onClick={() => markDone(item.id)}>
                  <div className="taskListTitleRow">
                    <span className="taskListStateIcon isUndone">○</span>
                    <span className="taskListTitleLink">{item.title}</span>
                  </div>
                </li>
              ))}
            </ul>

            {presets.length > 0 ? (
              <div className="supplyPresetWrap">
                {presets.map((preset) => (
                  <button key={preset.normalized_name} className="button pillButton" onClick={() => usePreset(preset.name)}>
                    {preset.name}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : items.length === 0 ? (
          <div className="empty">No done supplies.</div>
        ) : (
          <div className="taskDoneGroups">
            {doneGroups.map(([date, dateItems]) => (
              <details key={date} className="taskDoneMonthGroup">
                <summary className="taskDoneMonthHeader">{date} ({dateItems.length})</summary>
                <ul className="taskList">
                  {dateItems.map((item) => (
                    <li key={item.id} className="taskListRow supplyRow" onClick={() => markActive(item.id)}>
                      <div className="taskListRowMain">
                        <div className="taskListTitleRow">
                          <span className="taskListStateIcon isDone">✓</span>
                          <span className="taskListTitleLink taskLinkDone taskLinkDoneList">{item.title}</span>
                        </div>
                        <button
                          className="button compactFlatButton compactInlineButton buttonToneDanger"
                          onClick={(event) => {
                            event.stopPropagation();
                            hardDelete(item.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
