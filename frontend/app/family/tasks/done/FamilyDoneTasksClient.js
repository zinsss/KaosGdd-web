"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatFamilyDateTime, loadFamilyTasks, saveFamilyTasks, sortDoneFamilyTasks } from "../../familyTasks";

export default function FamilyDoneTasksClient() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTasks(loadFamilyTasks());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveFamilyTasks(tasks);
  }, [loaded, tasks]);

  const doneTasks = useMemo(() => sortDoneFamilyTasks(tasks.filter((task) => task.done)), [tasks]);

  function restoreTask(taskId) {
    const now = new Date().toISOString();
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: false,
              completed_at: "",
              updated_at: now,
            }
          : task,
      ),
    );
  }

  function deleteTask(taskId) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <section className="familyPage" aria-label="완료한 할 일">
      <div className="familyCard familyTaskPageCard">
        <header className="familyHeader">
          <div>
            <p className="familyKicker">할 일</p>
            <h1>완료한 할 일</h1>
          </div>
          <Link className="familyHeaderBadge familyHeaderLink" href="/family">
            대시보드
          </Link>
        </header>

        <main className="familyDoneTasks">
          {doneTasks.length ? (
            doneTasks.map((task) => (
              <article className="familyDoneTaskRow" key={task.id}>
                <div>
                  <h2>{task.title}</h2>
                  <time>{formatFamilyDateTime(task.completed_at || task.updated_at)}</time>
                </div>
                <div className="familyDoneTaskActions">
                  <button type="button" onClick={() => restoreTask(task.id)}>
                    복원
                  </button>
                  <button type="button" onClick={() => deleteTask(task.id)}>
                    삭제
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="familyTaskEmpty">완료한 할 일이 아직 없어요.</p>
          )}
        </main>
      </div>
    </section>
  );
}
