"use client";

import { useEffect, useState } from "react";

const EMPTY_SUPPORT_MODE = {
  enabled: false,
  active: false,
  enabledBy: "",
  reason: "",
  expiresAt: "",
  updatedAt: "",
};

const SUPPORT_DURATION_OPTIONS = [
  { label: "30분", minutes: 30 },
  { label: "1시간", minutes: 60 },
  { label: "24시간", minutes: 1440 },
];

function normalizeSupportMode(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    enabled: payload.enabled === true,
    active: payload.active === true,
    enabledBy: String(payload.enabledBy || ""),
    reason: String(payload.reason || ""),
    expiresAt: String(payload.expiresAt || ""),
    updatedAt: String(payload.updatedAt || ""),
  };
}

function expiresAtFromNow(minutes) {
  return new Date(Date.now() + Number(minutes || 60) * 60 * 1000).toISOString();
}

function formatSupportExpiry(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeAudit(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

async function fetchSupportMode() {
  const response = await fetch("/api/family/support-mode", { cache: "no-store" });
  const data = await response.json();
  return {
    supportMode: normalizeSupportMode(data?.supportMode),
    audit: normalizeAudit(data?.audit),
  };
}

async function saveSupportMode(supportMode) {
  const response = await fetch("/api/family/support-mode", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor: "family", supportMode }),
  });
  const data = await response.json();
  return {
    supportMode: normalizeSupportMode(data?.supportMode),
    audit: normalizeAudit(data?.audit),
  };
}

export default function FamilySupportModeSettings() {
  const [supportMode, setSupportMode] = useState(EMPTY_SUPPORT_MODE);
  const [audit, setAudit] = useState([]);
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSupportMode().then((data) => {
      if (cancelled) return;
      setSupportMode(data.supportMode);
      setReason(data.supportMode.reason);
      setAudit(data.audit);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleSupportMode() {
    setSaving(true);
    try {
      const turningOn = !supportMode.active;
      const next = {
        ...supportMode,
        enabled: turningOn,
        enabledBy: "가족",
        reason: reason.trim(),
        expiresAt: turningOn ? expiresAtFromNow(durationMinutes) : "",
      };
      const data = await saveSupportMode(next);
      setSupportMode(data.supportMode);
      setReason(data.supportMode.reason);
      setAudit(data.audit);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="familySupportModeSettings">
      <div className="familySupportModeHeader">
        <div>
          <h3>지원 모드</h3>
          <p>시스템 점검은 가능하지만, 가족 내용 확인은 이 타이머가 켜진 동안만 열려요.</p>
        </div>
        <button
          className={`familySupportModeToggle${supportMode.active ? " familySupportModeToggleActive" : ""}`}
          type="button"
          onClick={toggleSupportMode}
          disabled={saving}
          aria-pressed={supportMode.active}
        >
          {supportMode.active ? "켜짐" : "꺼짐"}
        </button>
      </div>

      <label className="familySupportReason">
        <span>시간</span>
        <select
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(Number(event.target.value))}
          disabled={supportMode.active}
        >
          {SUPPORT_DURATION_OPTIONS.map((option) => (
            <option key={option.minutes} value={option.minutes}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="familySupportReason">
        <span>이유</span>
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="예: 달력 오류 확인"
        />
      </label>

      {supportMode.active && supportMode.expiresAt ? (
        <p className="familySupportExpiry">만료: {formatSupportExpiry(supportMode.expiresAt)}</p>
      ) : null}

      {audit.length ? (
        <div className="familySupportAudit" aria-label="지원 모드 기록">
          {audit.slice(0, 3).map((item) => (
            <p key={item.id || `${item.action}-${item.createdAt}`}>
              {item.createdAt || ""} · {item.supportEnabled ? "켜짐" : "꺼짐"}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
