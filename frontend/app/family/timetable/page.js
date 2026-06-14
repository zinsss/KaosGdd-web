import FamilyHeader from "../FamilyHeader";
import FamilyTimetable from "../FamilyTimetable";

export const metadata = {
  title: "로니 - KaosGdd",
};

export default function FamilyTimetablePage() {
  return (
    <section className="familyPage" aria-label="로니">
      <div className="familyCard">
        <FamilyHeader active="home" />
        <FamilyTimetable />
      </div>
    </section>
  );
}
