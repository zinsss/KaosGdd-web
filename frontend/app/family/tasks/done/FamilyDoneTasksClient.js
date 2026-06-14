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
    <section className="familyPage" aria-label="다했데이">
      <div className="familyCard familyTaskPageCard">
        <FamilyHeader active="home" />

        <main className="familyDoneTasks">
          <h2 className="familyTaskPageTitle">다했데이</h2>
          {doneTasks.length ? (
            doneTasks.map((task) => (
              <article className="familyDoneTaskRow" key={task.id}>
                <div>
                  <h2>{task.title}</h2>
                  <time>{formatFamilyDateTime(task.completed_at || task.updated_at)}</time>
                </div>
                <div className="familyDoneTaskActions">
                  <button type="button" onClick={() => restoreTask(task.id)}>
                    도로묵이다
                  </button>
                  <button type="button" onClick={() => deleteTask(task.id)}>
                    치아라
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="familyTaskEmpty">다했데이가 아직 없어요.</p>
          )}
        </main>
      </div>
    </section>
  );
}
