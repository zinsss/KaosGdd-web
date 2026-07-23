import { Suspense } from "react";

import FamilyHeader from "../FamilyHeader";
import FamilyCalendar2Client from "./FamilyCalendar2Client";

export const metadata = {
  title: "달력 - KaosGdd",
};

export default function FamilyCalendar2Page() {
  return (
    <section className="familyPage" aria-label="달력">
      <div className="familyCard familyCalendar2PageCard">
        <FamilyHeader active="calendar" />
        <Suspense fallback={null}>
          <FamilyCalendar2Client />
        </Suspense>
      </div>
    </section>
  );
}
