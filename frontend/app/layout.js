import "./globals.css";
import Link from "next/link";
import BottomCaptureBar from "../components/BottomCaptureBar";
import AppShellHeightObserver from "../components/AppShellHeightObserver";
import TopNav from "../components/TopNav";
import PwaBootstrap from "../components/pwa/PwaBootstrap";
import { UI_STRINGS } from "../lib/strings";

export const metadata = {
  title: UI_STRINGS.APP_TITLE_WEB,
  description: UI_STRINGS.APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: UI_STRINGS.APP_TITLE_WEB,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11111b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaBootstrap />
        <AppShellHeightObserver />
        <header className="appShellTop">
          <div className="appShellTopInner">
            <div className="appHeaderLine">
              <Link className="appHeaderTitle appHeaderTitleLink" href="/">{UI_STRINGS.APP_TITLE}</Link>
              <span className="appHeaderDot"> • </span>
              <span className="appHeaderSubtitle">{UI_STRINGS.APP_HEADER_SUBTITLE}</span>
            </div>
            <TopNav />
            <BottomCaptureBar />
          </div>
        </header>

        <div className="appShellTopSpacer" />

        <main className="appShellMain">
          {children}
        </main>
      </body>
    </html>
  );
}
