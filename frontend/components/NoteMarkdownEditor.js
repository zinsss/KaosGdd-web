"use client";

import dynamic from "next/dynamic";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";

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
      fontFamily: "inherit",
      lineHeight: "1.5",
    },
    ".cm-content": {
      caretColor: "var(--ctp-lavender)",
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

export default function NoteMarkdownEditor({ value, onChange }) {
  return (
    <CodeMirror
      value={value}
      height="360px"
      extensions={[markdown(), kaosEditorTheme]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
      }}
    />
  );
}
