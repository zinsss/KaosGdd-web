import Link from "next/link";

import FamilyHeader from "../FamilyHeader";

export const metadata = {
  title: "계기판 놀이 - KaosGdd",
};

export default function FamilyDashboardsPage() {
  return (
    <section className="familyPage" aria-label="계기판 놀이">
      <div className="familyCard">
        <FamilyHeader active="home" />

        <main className="familyDashboard">
          <section className="familyTaskSection" aria-label="계기판 놀이">
            <div className="familyTaskSectionHeader">
              <div>
                <h2>계기판 놀이</h2>
                <p>원하는 계기판을 골라요</p>
              </div>
              <Link className="familyTaskActionButton" href="/family">
                가족 홈
              </Link>
            </div>

            <div className="familyPlayTiles">
              <Link className="familyPlayTile familyIoniqTile" href="/family/ioniq-dashboard">
                <span className="familyIoniqTileIcon" aria-hidden="true">
                  <span className="familyIoniqTileNeedle" />
                </span>
                <span className="familyPlayTileText">
                  <strong>아이오닉 계기판</strong>
                  <span>버튼을 눌러 계기판을 움직여 보세요</span>
                </span>
              </Link>

              <Link className="familyPlayTile familyAnalogueTile" href="/family/analogue-dashboard">
                <span className="familyAnalogueTileIcon" aria-hidden="true">
                  <span className="familyAnalogueTileNeedle" />
                </span>
                <span className="familyPlayTileText">
                  <strong>아날로그 계기판</strong>
                  <span>바늘을 밀어서 속도와 연료를 바꿔 보세요</span>
                </span>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </section>
  );
}
