import FamilyHeader from "../FamilyHeader";
import FamilyCalendar2Client from "./FamilyCalendar2Client";

export const metadata = {
  title: "달력2 - KaosGdd",
};

export default function FamilyCalendar2Page() {
  return (
    <section className="familyPage" aria-label="달력2">
      <div className="familyCard familyCalendar2PageCard">
        <FamilyHeader active="calendar2" />
        <FamilyCalendar2Client />
      </div>
    </section>
  );
}
