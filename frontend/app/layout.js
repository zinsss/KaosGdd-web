export const metadata = {
  title: "KaosGdd Web",
  description: "Tailscale-only web UI for KaosGdd",
};

import "./globals.css";
import BottomCaptureBar from "../components/BottomCaptureBar";
import TopNav from "../components/TopNav";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="appShellHeader">
          <div className="appShellHeaderInner">
            <div className="appHeaderLine">
              <span className="appHeaderTitle">KaosGdd</span>
              <span className="appHeaderDot"> • </span>
              <span className="appHeaderSubtitle">Order for a Chaotic-Minded Gdd</span>
            </div>
          </div>
        </header>

        <main className="appShellMain">
          <div className="page">
            <TopNav />
          </div>
          {children}
        </main>

        <BottomCaptureBar />
      </body>
    </html>
  );
}