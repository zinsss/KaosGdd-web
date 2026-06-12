"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "kaosgdd:family-quick-pad-v0";

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    type: "message",
    text: "오늘 로운이 준비물 챙기기",
    createdAt: "처음 메모",
  },
];

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compactLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseChecklistInput(value) {
  const lines = compactLines(value);
  if (lines.length < 2) return null;

  return {
    title: lines[0],
    items: lines.slice(1).map((text) => ({
      id: createId(),
      text,
      checked: false,
    })),
  };
}

function getInputPlaceholder(checklistMode) {
  if (checklistMode) {
    return "첫 줄은 제목, 다음 줄부터 목록";
  }

  return "가족 메모를 남겨요";
}

function formatCreatedAt() {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function loadMessages() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : INITIAL_MESSAGES;
  } catch {
    return INITIAL_MESSAGES;
  }
}

function MessageBubble({ message, onToggleChecklistItem }) {
  if (message.type === "checklist") {
    return (
      <article className="familyBubble familyBubbleChecklist">
        <div className="familyBubbleTitle">{message.title}</div>
        <div className="familyChecklistRows">
          {message.items.map((item) => (
            <button
              className={`familyChecklistRow${item.checked ? " familyChecklistRowChecked" : ""}`}
              key={item.id}
              type="button"
              onClick={() => onToggleChecklistItem(message.id, item.id)}
            >
              <span className="familyChecklistBox" aria-hidden="true">
                {item.checked ? "☑" : "☐"}
              </span>
              <span className="familyChecklistText">{item.text}</span>
            </button>
          ))}
        </div>
        <time className="familyBubbleTime">{message.createdAt}</time>
      </article>
    );
  }

  return (
    <article className="familyBubble">
      <div className="familyBubbleText">{message.text}</div>
      <time className="familyBubbleTime">{message.createdAt}</time>
    </article>
  );
}

export default function FamilyPageClient() {
  const inputRef = useRef(null);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [checklistMode, setChecklistMode] = useState(false);
  const canSend = useMemo(() => {
    const lineCount = compactLines(draft).length;
    return checklistMode ? lineCount >= 2 : lineCount > 0;
  }, [checklistMode, draft]);

  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      return;
    }
  }, [messages]);

  useEffect(() => {
    requestAnimationFrame(resetInputHeight);
  }, [checklistMode]);

  function resetInputHeight() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "";
  }

  function resizeInputToContent(el = inputRef.current) {
    if (!el) return;
    el.style.height = "";
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  }

  function handleDraftChange(event) {
    setDraft(event.target.value);
    resizeInputToContent(event.currentTarget);
  }

  function sendMessage() {
    const lines = compactLines(draft);
    if (!lines.length) return;

    const nextMessage = checklistMode
      ? parseChecklistInput(draft)
      : {
          text: lines.join("\n"),
        };

    if (!nextMessage) return;

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        type: checklistMode ? "checklist" : "message",
        createdAt: formatCreatedAt(),
        ...nextMessage,
      },
    ]);
    setDraft("");
    requestAnimationFrame(resetInputHeight);
  }

  function toggleChecklistItem(messageId, itemId) {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId || message.type !== "checklist") return message;

        return {
          ...message,
          items: message.items.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
        };
      }),
    );
  }

  function onDraftKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <section className="familyPage" aria-label="가족 메모">
      <div className="familyCard">
        <header className="familyHeader">
          <div>
            <p className="familyKicker">우리집</p>
            <h1>가족 메모</h1>
          </div>
          <span className="familyHeaderBadge">빠른 기록</span>
        </header>

        <div className="familyStream" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble message={message} key={message.id} onToggleChecklistItem={toggleChecklistItem} />
          ))}
        </div>

        <div className="familyComposer">
          <button
            className={`familyChecklistToggle${checklistMode ? " familyChecklistToggleActive" : ""}`}
            type="button"
            aria-label="체크리스트 모드"
            aria-pressed={checklistMode}
            onClick={() => setChecklistMode((current) => !current)}
          >
            ☑
          </button>
          <textarea
            ref={inputRef}
            className="familyInput"
            value={draft}
            rows={checklistMode ? 4 : 2}
            placeholder={getInputPlaceholder(checklistMode)}
            aria-label="가족 메모 입력"
            onChange={handleDraftChange}
            onKeyDown={onDraftKeyDown}
          />
          <button className="familySend" type="button" disabled={!canSend} onClick={sendMessage}>
            보내기
          </button>
        </div>
      </div>
    </section>
  );
}
