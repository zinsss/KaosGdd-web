import FamilyHeader from "../FamilyHeader";
import FamilyCalendarClient from "./FamilyCalendarClient";

export const metadata = {
  title: "달력 - KaosGdd",
};

export default function FamilyCalendarPage() {
  return (
    <section className="familyPage" aria-label="달력">
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="calendar" />
        <FamilyCalendarClient />
      </div>
    </section>
  );
}
