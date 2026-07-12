import WeatherLocationSettings from "../../../components/settings/WeatherLocationSettings";
import FamilyHeader from "../FamilyHeader";
import FamilySupportModeSettings from "./FamilySupportModeSettings";

export const metadata = {
  title: "설정 - KaosGdd",
};

export default function FamilySettingsPage() {
  return (
    <section className="familyPage" aria-label="설정">
      <div className="familyCard familySettingsCard">
        <FamilyHeader active="settings" />

        <div className="familyQuickPadTitle">
          <h2>설정</h2>
        </div>

        <section className="familySettingsSection" aria-label="날씨">
          <div className="familySettingsRow">
            <div>
              <h3>날씨 지역</h3>
              <p>달력과 메인 화면에서 함께 사용하는 날씨 지역이에요.</p>
            </div>
            <WeatherLocationSettings />
          </div>
        </section>

        <section className="familySettingsSection" aria-label="지원">
          <FamilySupportModeSettings />
        </section>
      </div>
    </section>
  );
}
