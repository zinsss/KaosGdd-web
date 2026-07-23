import "./globals.css";
import { headers } from "next/headers";
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
    statusBarStyle: "black",
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

const FAMILY_HOST = "family.kaosgdd.net";

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") || "").split(":")[0].toLowerCase();
  const initialFamilyHost = host === FAMILY_HOST;

  return (
    <html lang="en">
      <body>
        <PwaBootstrap />
        <DebugTapPanel />
        <AppShellFrame initialFamilyHost={initialFamilyHost}>{children}</AppShellFrame>
      </body>
    </html>
  );
}
