"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FamilyHeader from "./FamilyHeader";
import { fetchFamilyRecord, persistFamilyRecord } from "./familyBackendStore";

const STORAGE_KEY = "kaosgdd:family-quick-pad-v0";
const MEMO_RECORD_KEY = "memo-messages";

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

function buildCheckedStateQueues(items) {
  const queues = new Map();

  for (const item of items || []) {
    const text = String(item?.text || "");
    if (!text) continue;
    const queue = queues.get(text) || [];
    queue.push({ id: item.id || createId(), checked: Boolean(item.checked) });
    queues.set(text, queue);
  }

  return queues;
}

export function applyChecklistEdit(parsedChecklist, existingItems = []) {
  const checkedStateQueues = buildCheckedStateQueues(existingItems);

  return parsedChecklist.items.map((item) => {
    const queue = checkedStateQueues.get(item.text) || [];
    const previous = queue.shift();

    return {
      id: previous?.id || item.id || createId(),
      text: item.text,
      checked: previous ? previous.checked : false,
    };
  });
}

function checklistToDraft(message) {
  return [message.title, ...(message.items || []).map((item) => item.text)].filter(Boolean).join("\n");
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

async function fetchMessages() {
  const fallback = loadMessages();
  const payload = await fetchFamilyRecord(MEMO_RECORD_KEY, fallback);
  return Array.isArray(payload) && payload.length ? payload : fallback;
}

async function persistMessages(messages) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // local mirror is best-effort only
  }
  await persistFamilyRecord(MEMO_RECORD_KEY, messages);
}

function MessageBubble({ isEditing, message, onDeleteMessage, onEditMessage, onToggleChecklistItem }) {
  const isChecklist = message.type === "checklist";
  const deleteLabel = isChecklist ? "체크리스트 삭제" : "메모 삭제";
  const editLabel = isChecklist ? "체크리스트 수정" : "메모 수정";

  return (
    <div className={`familyBubbleRow${isEditing ? " familyBubbleEditing" : ""}`}>
      <article className={`familyBubble${isChecklist ? " familyBubbleChecklist" : ""}`}>
        <button
          className="familyBubbleDeleteIcon"
          type="button"
          aria-label={deleteLabel}
          onClick={() => onDeleteMessage(message.id)}
        >
          ×
        </button>

        <div className="familyBubbleContent">
          {isChecklist ? (
            <>
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
            </>
          ) : (
            <div className="familyBubbleText">{message.text}</div>
          )}
        </div>

        <div className="familyBubbleFooter">
          <time className="familyBubbleTime">{message.createdAt}</time>
          <button className="familyBubbleEditIcon" type="button" aria-label={editLabel} onClick={() => onEditMessage(message)}>
            ✎
          </button>
        </div>
      </article>
    </div>
  );
}

export default function FamilyPageClient() {
  const inputRef = useRef(null);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [checklistMode, setChecklistMode] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const isEditing = Boolean(editingMessageId);
  const canSend = useMemo(() => {
    const lineCount = compactLines(draft).length;
    return checklistMode ? lineCount >= 2 : lineCount > 0;
  }, [checklistMode, draft]);

  useEffect(() => {
    let cancelled = false;
    fetchMessages().then((loadedMessages) => {
      if (cancelled) return;
      setMessages(loadedMessages);
      setMessagesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!messagesLoaded) return;
    persistMessages(messages);
  }, [messages, messagesLoaded]);

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

  function resetComposer() {
    setDraft("");
    setEditingMessageId(null);
    setChecklistMode(false);
    requestAnimationFrame(resetInputHeight);
  }

  function focusAndResizeInput() {
    requestAnimationFrame(() => {
      resizeInputToContent();
      inputRef.current?.focus();
    });
  }

  function handleDraftChange(event) {
    setDraft(event.target.value);
    resizeInputToContent(event.currentTarget);
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setChecklistMode(message.type === "checklist");
    setDraft(message.type === "checklist" ? checklistToDraft(message) : message.text || "");
    focusAndResizeInput();
  }

  function deleteMessage(messageId) {
    if (!window.confirm("삭제할까요?")) return;

    setMessages((current) => current.filter((message) => message.id !== messageId));

    if (editingMessageId === messageId) {
      resetComposer();
    }
  }

  function saveEditedMessage(nextMessage) {
    setMessages((current) =>
      current.map((message) => (message.id === editingMessageId ? { ...message, ...nextMessage } : message)),
    );
    resetComposer();
  }

  function sendMessage() {
    const lines = compactLines(draft);
    if (!lines.length) return;

    if (isEditing) {
      const existingMessage = messages.find((message) => message.id === editingMessageId);

      if (checklistMode) {
        const parsedChecklist = parseChecklistInput(draft);
        if (!parsedChecklist) return;
        const existingItems = existingMessage?.type === "checklist" ? existingMessage.items : [];

        saveEditedMessage({
          type: "checklist",
          title: parsedChecklist.title,
          items: applyChecklistEdit(parsedChecklist, existingItems),
        });
        return;
      }

      saveEditedMessage({
        type: "message",
        text: lines.join("\n"),
      });
      return;
    }

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
    <section className="familyPage" aria-label="메모장">
      <div className="familyCard">
        <FamilyHeader active="memo" />

        <div className="familyQuickPadTitle">
          <h2>메모장</h2>
        </div>

        <div className="familyStream" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble
              isEditing={message.id === editingMessageId}
              message={message}
              key={message.id}
              onDeleteMessage={deleteMessage}
              onEditMessage={startEditMessage}
              onToggleChecklistItem={toggleChecklistItem}
            />
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
            
          </button>
          <textarea
            ref={inputRef}
            className="familyInput"
            value={draft}
            rows={checklistMode ? 4 : 1}
            placeholder={getInputPlaceholder(checklistMode)}
            aria-label="가족 메모 입력"
            onChange={handleDraftChange}
            onKeyDown={onDraftKeyDown}
          />
          <button className="familySend" type="button" disabled={!canSend} onClick={sendMessage}>
            {isEditing ? "저장" : "보내기"}
          </button>
          {isEditing ? (
            <button className="familyCancel" type="button" onClick={resetComposer}>
              취소
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
