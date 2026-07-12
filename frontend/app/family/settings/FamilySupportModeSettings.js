"use client";

import { useEffect, useState } from "react";

const EMPTY_SUPPORT_MODE = {
  enabled: false,
  enabledBy: "",
  reason: "",
  expiresAt: "",
  updatedAt: "",
};

function normalizeSupportMode(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    enabled: payload.enabled === true,
    enabledBy: String(payload.enabledBy || ""),
    reason: String(payload.reason || ""),
    expiresAt: String(payload.expiresAt || ""),
    updatedAt: String(payload.updatedAt || ""),
  };
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
      const next = {
        ...supportMode,
        enabled: !supportMode.enabled,
        enabledBy: "가족",
        reason: reason.trim(),
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
          <p>문제를 고칠 때만 임시로 켜는 도움 모드예요. 켜고 끈 기록은 남아요.</p>
        </div>
        <button
          className={`familySupportModeToggle${supportMode.enabled ? " familySupportModeToggleActive" : ""}`}
          type="button"
          onClick={toggleSupportMode}
          disabled={saving}
          aria-pressed={supportMode.enabled}
        >
          {supportMode.enabled ? "켜짐" : "꺼짐"}
        </button>
      </div>

      <label className="familySupportReason">
        <span>이유</span>
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="예: 달력 오류 확인"
        />
      </label>

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
