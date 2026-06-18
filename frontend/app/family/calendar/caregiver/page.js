import FamilyHeader from "../../FamilyHeader";
import FamilyCaregiverMonthlyReviewClient from "./FamilyCaregiverMonthlyReviewClient";

export const metadata = {
  title: "돌봄 - KaosGdd",
};

export default async function FamilyCaregiverReviewPage({ searchParams }) {
  const params = await searchParams;
  return (
    <section className="familyPage" aria-label="돌봄">
      <div className="familyCard familyCalendarPageCard">
        <FamilyHeader active="calendar" />
        <FamilyCaregiverMonthlyReviewClient month={params?.month || ""} />
      </div>
    </section>
  );
}
