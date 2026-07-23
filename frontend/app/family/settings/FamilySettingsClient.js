"use client";

import WeatherLocationSettings from "../../../components/settings/WeatherLocationSettings";

export default function FamilySettingsClient() {
  return (
    <main className="familyDashboard familySettings">
      <section className="familyTaskSection familySettingsSection" aria-label="가족 설정">
        <div className="familyTaskSectionHeader">
          <div>
            <h2>설정</h2>
            <p>가족 화면에서 쓰는 설정이에요</p>
          </div>
        </div>

        <div className="familySettingsList">
          <label className="familySettingsRow">
            <span>
              <strong>날씨 지역</strong>
              <small>달력에 보이는 날씨를 바꿔요</small>
            </span>
            <WeatherLocationSettings />
          </label>
        </div>
      </section>
    </main>
  );
}
