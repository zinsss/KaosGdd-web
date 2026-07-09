import "./globals.css";
import AppShellFrame from "../components/AppShellFrame";
import DebugTapPanel from "../components/DebugTapPanel";
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
        <DebugTapPanel />
        <AppShellFrame>{children}</AppShellFrame>
      </body>
    </html>
  );
}
