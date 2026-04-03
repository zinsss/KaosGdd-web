"use client";

import { useState } from "react";

export default function ToggleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="panel">
      <div className="toggleHeaderRow">
        <div className="sectionTitle toggleTitle">{title}</div>
        <button
          type="button"
          className="button compactButton"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open ? <div className="toggleBody">{children}</div> : null}
    </section>
  );
}