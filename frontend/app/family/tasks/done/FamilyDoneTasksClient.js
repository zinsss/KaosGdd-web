"use client";

import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "../../FamilyHeader";
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
    <section className="familyPage" aria-label="완료">
      <div className="familyCard familyTaskPageCard">
        <FamilyHeader active="home" />

        <main className="familyDoneTasks">
          <h2 className="familyTaskPageTitle">완료</h2>
          {doneTasks.length ? (
            doneTasks.map((task) => (
              <article className="familyDoneTaskRow" key={task.id}>
                <div>
                  <h2>{task.title}</h2>
                  <time>{formatFamilyDateTime(task.completed_at || task.updated_at)}</time>
                </div>
                <div className="familyDoneTaskActions">
                  <button type="button" onClick={() => restoreTask(task.id)}>
                    완료 취소
                  </button>
                  <button type="button" onClick={() => deleteTask(task.id)}>
                    삭제
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="familyTaskEmpty">완료된 할 일이 아직 없어요.</p>
          )}
        </main>
      </div>
    </section>
  );
}
