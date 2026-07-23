import FamilyHeader from "../FamilyHeader";
import FamilySettingsClient from "./FamilySettingsClient";

export const metadata = {
  title: "가족 설정 - KaosGdd",
};

export default function FamilySettingsPage() {
  return (
    <section className="familyPage" aria-label="가족 설정">
      <div className="familyCard">
        <FamilyHeader active="settings" />
        <FamilySettingsClient />
      </div>
    </section>
  );
}
