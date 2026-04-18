"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function buildCaptureText(text, url) {
  const lines = [];
  const cleanText = (text || "").trim();
  const cleanUrl = (url || "").trim();
  if (cleanText) lines.push(cleanText);
  if (cleanUrl) lines.push(cleanUrl);
  return lines.join("\n").trim();
}

export default function ShareIntakePage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const text = params.get("text") || "";
    const url = params.get("url") || "";
    const sharedFileCount = Number(params.get("sharedFiles") || "0");

    const captureRaw = buildCaptureText(text, url);
    if (captureRaw) {
      window.sessionStorage.setItem("kaosgdd_capture_prefill", captureRaw);
    }

    if (sharedFileCount > 0) {
      window.sessionStorage.setItem(
        "kaosgdd_share_feedback",
        `${sharedFileCount} file${sharedFileCount > 1 ? "s" : ""} imported to Files.`,
      );
      router.replace("/files");
      return;
    }

    router.replace("/tasks");
  }, [router]);

  return (
    <main className="page">
      <section className="panel">
        <div className="subline">Importing shared content...</div>
      </section>
    </main>
  );
}
