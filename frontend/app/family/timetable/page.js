import FamilyHeader from "../FamilyHeader";
import FamilyTimetable from "../FamilyTimetable";

export const metadata = {
  title: "뭔일이고 - KaosGdd",
};

export default function FamilyTimetablePage() {
  return (
    <section className="familyPage" aria-label="뭔일이고">
      <div className="familyCard">
        <FamilyHeader active="home" />
        <FamilyTimetable />
      </div>
    </section>
  );
}
