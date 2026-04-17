"use client";

import dynamic from "next/dynamic";
import { markdown } from "@codemirror/lang-markdown";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

export default function NoteMarkdownEditor({ value, onChange }) {
  return (
    <CodeMirror
      value={value}
      height="360px"
      extensions={[markdown()]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
      }}
      theme="light"
    />
  );
}
