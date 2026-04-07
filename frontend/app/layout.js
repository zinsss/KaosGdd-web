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
        <header className="appShellTop">
          <div className="appShellTopInner">
            <div className="appHeaderLine">
              <span className="appHeaderTitle">KaosGdd</span>
              <span className="appHeaderDot"> • </span>
              <span className="appHeaderSubtitle">Order for Chaotic-Minded Gdd</span>
            </div>
            <TopNav />
          </div>
        </header>

        <main className="appShellMain">{children}</main>

        <BottomCaptureBar />
      </body>
    </html>
  );
}