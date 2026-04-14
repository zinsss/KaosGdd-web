import TasksPageClient from "../../components/TasksPageClient";

const TASK_MODES = ["active", "done", "removed", "archived"];

export default function TasksPage({ searchParams }) {
  const mode = TASK_MODES.includes(searchParams?.mode) ? searchParams.mode : "active";
  return <TasksPageClient initialMode={mode} />;
}
