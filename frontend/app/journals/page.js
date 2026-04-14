import JournalsPageClient from "./JournalsPageClient";

async function getJournals() {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  try {
    const res = await fetch(base + "/journals", { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function JournalsPage() {
  const result = await getJournals();
  return <JournalsPageClient items={result.items || []} />;
}
