"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FamilyHeader from "./FamilyHeader";
import { formatFamilyDate, loadFamilyTasks, saveFamilyTasks, sortActiveFamilyTasks } from "./familyTasks";

export default function FamilyDashboardClient() {
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

  const activeTasks = useMemo(() => sortActiveFamilyTasks(tasks.filter((task) => !task.done)), [tasks]);

  function completeTask(taskId) {
    const now = new Date().toISOString();
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: true,
              completed_at: now,
              updated_at: now,
            }
          : task,
      ),
    );
  }

  return (
    <section className="familyPage" aria-label="우짜노우짤꼬">
      <div className="familyCard">
        <FamilyHeader active="home" />

        <main className="familyDashboard">
          <section className="familyTaskSection familyDashboardPanel" aria-label="뭔날">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>뭔날</h2>
                <p>가족 달력은 여기에 이어 붙일 거예요.</p>
              </div>
              <span className="familyTaskActionButton familyTaskActionButtonMuted">뭔날이고</span>
            </div>
          </section>

          <section className="familyTaskSection familyDashboardPanel" aria-label="뭔일">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>뭔일</h2>
                <p>매주 반복되는 일을 챙겨요.</p>
              </div>
              <Link className="familyTaskActionButton familyTaskActionButtonPrimary" href="/family/timetable">
                뭔일이고
              </Link>
            </div>
          </section>

          <section className="familyTaskSection" aria-label="하그라">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>하그라</h2>
                <p>{activeTasks.length}개 남음</p>
              </div>
              <div className="familyTaskHeaderActions">
                <Link className="familyTaskActionButton familyTaskActionButtonPrimary" href="/family/tasks/new">
                  + 하그라
                </Link>
                <Link className="familyTaskActionButton" href="/family/tasks/done">
                  다했데이
                </Link>
              </div>
            </div>

            <div className="familyTaskList">
              {activeTasks.length ? (
                activeTasks.map((task) => (
                  <article className="familyTaskCard" key={task.id}>
                    <button
                      className="familyTaskCheck"
                      type="button"
                      aria-label={`${task.title} 완료`}
                      onClick={() => completeTask(task.id)}
                    >
                      □
                    </button>
                    <div className="familyTaskCardBody">
                      <h3>{task.title}</h3>
                      <div className="familyTaskMeta">
                        {task.due_date ? <span>{formatFamilyDate(task.due_date)}</span> : null}
                        {task.assignee ? <span>{task.assignee}</span> : null}
                      </div>
                    </div>
                    <Link className="familyTaskEdit" href={`/family/tasks/${task.id}/edit`} aria-label={`${task.title} 고치까`}>
                      ✎
                    </Link>
                  </article>
                ))
              ) : (
                <p className="familyTaskEmpty">아직 하그라가 없어요.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
