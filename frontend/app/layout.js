import "./globals.css";
import BottomCaptureBar from "../components/BottomCaptureBar";
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
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121212",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PwaBootstrap />
        <header className="appShellTop">
          <div className="appShellTopInner">
            <div className="appHeaderLine">
              <span className="appHeaderTitle">{UI_STRINGS.APP_TITLE}</span>
              <span className="appHeaderDot"> • </span>
              <span className="appHeaderSubtitle">{UI_STRINGS.APP_HEADER_SUBTITLE}</span>
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
