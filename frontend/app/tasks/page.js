import TasksPageClient from "../../components/TasksPageClient";

const TASK_MODES = ["active", "done", "removed", "archived"];

function firstSearchParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TasksPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const modeParam = firstSearchParam(resolvedSearchParams?.mode);
  const mode = TASK_MODES.includes(modeParam) ? modeParam : "active";
  return <TasksPageClient initialMode={mode} />;
}
