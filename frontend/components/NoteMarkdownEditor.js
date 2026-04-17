"use client";

import dynamic from "next/dynamic";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

const kaosEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--ui-input)",
      color: "var(--ui-text)",
      border: "1px solid var(--ui-border)",
      borderRadius: "8px",
      fontFamily:
        '"Sarasa Gothic Mono", "Noto Sans Mono CJK KR", "D2Coding", "SFMono-Regular", "Menlo", "Consolas", monospace',
      fontSize: "0.95rem",
    },
    ".cm-scroller": {
      backgroundColor: "var(--ui-input)",
      fontFamily: "inherit",
      lineHeight: "1.5",
    },
    ".cm-content": {
      caretColor: "var(--ctp-lavender)",
      color: "var(--ui-text)",
      padding: "10px 0",
    },
    ".cm-line": {
      padding: "0 12px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--ctp-lavender)",
    },
    ".cm-focused": {
      outline: "1px solid var(--ctp-lavender)",
      outlineOffset: "0",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(180, 190, 254, 0.22)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(186, 194, 222, 0.06)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--ui-panel)",
      color: "var(--ui-text-dimmer)",
      borderRight: "1px solid var(--ui-border)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 10px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(186, 194, 222, 0.08)",
      color: "var(--ui-text-dim)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "1px solid var(--ui-border)",
      color: "var(--ui-text-dim)",
    },
  },
  { dark: true }
);

const kaosHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--ctp-lavender)", fontWeight: "700" },
  { tag: tags.list, color: "var(--ctp-teal)" },
  { tag: tags.emphasis, color: "var(--ctp-yellow)", fontStyle: "italic" },
  { tag: tags.strong, color: "var(--ctp-peach)", fontWeight: "700" },
  { tag: tags.monospace, color: "var(--ctp-green)" },
  { tag: tags.quote, color: "var(--ctp-overlay2)" },
  { tag: [tags.link, tags.url], color: "var(--ctp-blue)", textDecoration: "underline" },
  { tag: tags.keyword, color: "var(--ctp-mauve)" },
  { tag: tags.string, color: "var(--ctp-green)" },
  { tag: tags.number, color: "var(--ctp-peach)" },
  { tag: tags.comment, color: "var(--ctp-overlay1)" },
  { tag: tags.invalid, color: "var(--ctp-red)" },
]);

export default function NoteMarkdownEditor({ value, onChange, height = "360px" }) {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme="dark"
      extensions={[markdown(), kaosEditorTheme, syntaxHighlighting(kaosHighlightStyle)]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
      }}
    />
  );
}
