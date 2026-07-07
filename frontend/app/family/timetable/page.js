import FamilyHeader from "../FamilyHeader";
import FamilyTimetable from "../FamilyTimetable";

export const metadata = {
  title: "로운이 시간표 - KaosGdd",
};

export default function FamilyTimetablePage() {
  return (
    <section className="familyPage" aria-label="로운이 시간표">
      <div className="familyCard">
        <FamilyHeader active="home" />
        <FamilyTimetable />
      </div>
    </section>
  );
}
