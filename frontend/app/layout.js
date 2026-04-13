export const metadata = {
  title: "KaosGdd Web",
  description: "Tailscale-only web UI for KaosGdd",
};

import "./globals.css";
import "./legacy-shell-fix.css";
import BottomCaptureBar from "../components/BottomCaptureBar";
import TopNav from "../components/TopNav";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="appShellTop">
          <div className="appShellTopInner">
            <div className="appHeaderLine">
              <span className="appHeaderTitle">KaosGdd</span>
              <span className="appHeaderDot"> • </span>
              <span className="appHeaderSubtitle">Order for a Chaotic-Minded Gdd</span>
            </div>
            <TopNav />
          </div>
        </header>

        <div className="appShellTopSpacer" />

        <main className="appShellMain">{children}</main>

        <BottomCaptureBar />
      </body>
    </html>
  );
}
