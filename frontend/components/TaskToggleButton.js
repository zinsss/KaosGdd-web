"use client";

import { useState } from "react";

export default function TaskToggleButton(props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onClick() {
    setIsSubmitting(true);
    try {
      await fetch("/api/tasks/" + props.taskId + "/toggle", { method: "POST" });
      window.location.reload();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button className="button" onClick={onClick} disabled={isSubmitting}>
      {isSubmitting ? "..." : props.isDone ? "Undo" : "Done"}
    </button>
  );
}