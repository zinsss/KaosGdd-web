"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
    <section className="familyPage" aria-label="가족 대시보드">
      <div className="familyCard">
        <header className="familyHeader">
          <div>
            <p className="familyKicker">우리집</p>
            <h1>가족 대시보드</h1>
          </div>
          <nav className="familyHomeNav" aria-label="가족 화면">
            <Link className="familyHomeNavLink familyHomeNavLinkActive" href="/family">
              대시보드
            </Link>
            <Link className="familyHomeNavLink" href="/family/memo">
              메모장
            </Link>
          </nav>
        </header>

        <main className="familyDashboard">
          <section className="familyTaskSection" aria-label="할 일">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>할 일</h2>
                <p>{activeTasks.length}개 남음</p>
              </div>
              <div className="familyTaskHeaderActions">
                <Link className="familyTaskActionButton familyTaskActionButtonPrimary" href="/family/tasks/new">
                  + 추가
                </Link>
                <Link className="familyTaskActionButton" href="/family/tasks/done">
                  완료 보기
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
                    <Link className="familyTaskEdit" href={`/family/tasks/${task.id}/edit`} aria-label={`${task.title} 수정`}>
                      ✎
                    </Link>
                  </article>
                ))
              ) : (
                <p className="familyTaskEmpty">아직 남은 할 일이 없어요.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
