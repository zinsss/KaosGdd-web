function ymdFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function routineDueRank(task, todayYmd) {
  const dueYmd = ymdFromValue(task?.due_at || task?.due_date || task?.due);
  if (!dueYmd) return 3;
  if (dueYmd < todayYmd) return 0;
  if (dueYmd === todayYmd) return 1;
  return 2;
}

function compareRoutineTasks(todayYmd) {
  return (left, right) => {
    const leftRank = routineDueRank(left, todayYmd);
    const rightRank = routineDueRank(right, todayYmd);
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftDue = ymdFromValue(left?.due_at || left?.due_date || left?.due);
    const rightDue = ymdFromValue(right?.due_at || right?.due_date || right?.due);
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);

    const leftCreated = String(left?.created_at || "");
    const rightCreated = String(right?.created_at || "");
    if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated);

    return String(left?.id || "").localeCompare(String(right?.id || ""));
  };
}

export function splitActiveTasksForRoutineBox(tasks, todayYmd, mode = "active") {
  const list = Array.isArray(tasks) ? tasks : [];
  if (mode !== "active") {
    return { routineTasks: [], normalTasks: list };
  }

  const routineTasks = [];
  const normalTasks = [];
  for (const task of list) {
    if (task?.repeat_rule) {
      routineTasks.push(task);
    } else {
      normalTasks.push(task);
    }
  }

  return {
    routineTasks: routineTasks.sort(compareRoutineTasks(todayYmd)),
    normalTasks,
  };
}
