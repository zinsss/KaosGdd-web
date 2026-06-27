# Capture Grammar

KaosGdd capture is prefix-based. The first non-empty line decides whether capture creates a durable item, opens a modal flow, or rejects the input.

This document separates the grammars by module and gives examples.

`list` is not a product module and is not planned. The legacy `==` prefix may still appear in parser compatibility code, but new UI and tests should not expand it into a feature.

## Routing Rules

1. Explicit prefixes always win.
2. Module pages can imply a prefix for unprefixed input.
3. Edit mode does not apply implied grammar.
4. Attached file behavior is special:
   - selected file + `fax:{number}` means transient outgoing fax.
   - selected file + `++ ...` means durable File save, with optional linked fax send.
   - selected file + anything else should produce a validation error and keep the file selected.

## Common Metadata

Supported where the module allows it:

```text
d:YYYY-MM-DD
r:YYYY-MM-DD HH:MM
dr:YYYY-MM-DD HH:MM
R:...
#tag
"""
memo lines
"""
```

Meanings:

- `d:` due date or event date depending on module context.
- `r:` reminder time.
- `dr:` task-only shorthand that sets both due and reminder.
- `R:` repeat rule.
- `#tag` tag.
- Triple quotes delimit memo blocks.

Rules:

- `dr:` is task-only.
- `dr:` cannot be combined with separate `d:` or `r:`.
- Subtask metadata is not allowed.
- Journal content does not support `d:`, `r:`, `dr:`, or `R:`.

## Task Grammar

Prefix:

```text
-- 
```

Done task prefix:

```text
-x 
```

Subtasks:

```text
--- 
--x 
```

Example:

```text
-- 약 사기
d:2026-06-30
r:2026-06-30 09:00
#family
"""
아침 등원 전에 확인.
"""
--- 약국 전화
--- 결제
```

Parsed behavior:

- Creates a task.
- Sets due and reminder.
- Adds tag `family`.
- Adds memo.
- Adds two open subtasks.

Done example:

```text
-x 영수증 정리
d:2026-06-27
```

Task with combined due/reminder:

```text
-- 병원 서류 제출
dr:2026-07-01 08:30
```

Invalid examples:

```text
--- 하위 작업만 단독 입력
```

Reason: subtask requires a parent task.

```text
-- 예약하기
dr:2026-07-01 09:00
d:2026-07-01
```

Reason: `dr:` cannot be combined with `d:`.

## Event Grammar

Prefix:

```text
^^ 
```

Single-date inline example:

```text
^^ 2026-07-01 병원
r:2026-07-01 08:30
#medical
```

Date range example:

```text
^^ 2026-07-10 ~ 2026-07-12 여행
```

Date on metadata line:

```text
^^ 학교 상담
d:2026-07-04
```

Repeat example:

```text
^^ 2026-07-01 운동
R:weekly
```

Rules:

- Event date is required.
- Event title is required.
- Multiple event dates are rejected.
- Event repeat rules use event repeat normalization.

Invalid examples:

```text
^^
```

Reason: missing date.

```text
^^ 2026-07-01
```

Reason: missing title.

## Reminder Grammar

Prefix:

```text
!! 
```

Example:

```text
!! 2026-07-01 09:00 전화하기
```

Multiline title example:

```text
!! 2026-07-01 09:00
병원 전화
서류 확인
```

Rules:

- Reminder title lines are joined.
- Standalone reminders do not support `l:`.

## Journal Grammar

Prefix:

```text
// 
```

Example:

```text
// 오늘 기록
#family
로운이가 새 단어를 말했다.
```

Rules:

- Journal content is required.
- Journal body lines become memo/content.
- Journal does not support due, reminder, or repeat metadata.

Invalid example:

```text
// 기록
r:2026-07-01 09:00
```

Reason: Journal does not support reminder metadata.

## Scribble Grammar

Prefix:

```text
... 
```

Example:

```text
... 보험 서류 확인해야 함 #admin
```

Behavior:

- Creates a transient Scribble.
- Scribble is a staging workspace, not a Journal subtype.

## Supply Grammar

Prefix:

```text
$$ 
```

Example:

```text
$$ 우유
```

Rules:

- Supply title is required.
- Extra unrecognized lines are rejected.

## Note Modal Grammar

Prefix:

```text
:::
```

Template:

```text
:::
title: 보험 메모
tags: admin
link:
:::
본문 내용
```

Behavior:

- Opens or submits the note modal flow depending on UI path.
- Notes use metadata between opening and closing `:::` lines.

## File Grammar

Prefix:

```text
++
```

Selected file save example:

```text
++ 보험 서류
#admin
"""
원본 스캔본.
"""
```

Required first line:

```text
++ {title}
```

Allowed following lines:

```text
#tag
l:item_id
x:02-1234-5678
"""
memo
"""
```

Behavior:

- Creates a durable File item for the selected attachment.
- Optional `x:{number}` can send a fax linked to the saved File.

Important:

- File grammar requires a selected file.
- File save is not the same as transient fax send.

## Fax Grammar

Prefix:

```text
fax:
```

Transient selected-file fax example:

```text
fax:02-1234-5678
```

Behavior:

- Valid only when a file is selected.
- `fax:` must be the first token.
- Fax number is required.
- No `++ title` is required.
- No durable File item is created.
- Creates an outgoing Fax record.
- Sends the selected file as the fax source.
- If send fails, selected file should remain selected for retry.

Status messages should be fax-specific, not File save-specific:

- `{filename} · Fax queued`
- `{filename} · Fax send failed`
- `Fax number required`
- `Select a file first`

## Mail Grammar

Prefix:

```text
mail:
```

Current status:

- Recognized as a modal prefix.
- Do not expand behavior without a dedicated Mail PR.

## Deprecated Legacy Prefix: `==`

Prefix:

```text
==
```

Current parser compatibility:

- The parser may classify it as `modal_type="list"`.

Product direction:

- `list` is not a module.
- `list` is not planned.
- Do not add frontend routes, docs, UI, schema, or tests that make `==` a supported product feature.

## Module-Implied Grammar

File: `frontend/lib/module-implied-capture.js`.

When the user types unprefixed text on a module page, the frontend may add the module prefix before submitting.

Examples:

On `/tasks`:

```text
약 사기
```

becomes:

```text
-- 약 사기
```

On `/events`:

```text
병원
d:2026-07-01
```

becomes:

```text
^^ 2026-07-01 병원
```

On `/notes`:

```text
보험 메모
본문
```

becomes a note modal grammar block.

Rules:

- Explicit grammar is not rewritten.
- Edit mode is not rewritten.
- Attached files only imply grammar on modules that require files (`/files`, `/fax`).
- Attached files suppress implied grammar for non-file modules.

## Post-Create Navigation

After capture, the frontend inspects created item types and navigates to the most relevant module. Fax can win when a fax also creates or links a file. This behavior is centralized in `frontend/lib/post-create-navigation.js`.
