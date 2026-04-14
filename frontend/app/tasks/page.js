import TasksPageClient from "../../components/TasksPageClient";

const TASK_MODES = ["active", "done", "removed", "archived"];

async function getTasks(mode) {
  const base = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
  const suffix = mode && mode !== "active" ? `?mode=${encodeURIComponent(mode)}` : "";
  try {
    const res = await fetch(base + "/tasks" + suffix, { cache: "no-store" });
    return await res.json();
  } catch {
    return { items: [] };
  }
}

export default async function TasksPage({ searchParams }) {
  const mode = TASK_MODES.includes(searchParams?.mode) ? searchParams.mode : "active";
  const tasks = await getTasks(mode);

  return <TasksPageClient initialMode={mode} initialItems={tasks.items || []} />;
}
