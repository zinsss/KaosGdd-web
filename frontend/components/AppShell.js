"use client";

import { usePathname } from "next/navigation";

import AppHeaderTitle from "./AppHeaderTitle";
import TopCaptureBar from "./TopCaptureBar";
import AppShellHeightObserver from "./AppShellHeightObserver";
import AttentionBox from "./AttentionBox";
import TopNav from "./TopNav";
import { UI_STRINGS } from "../lib/strings";

const BARE_SHELL_PATHS = ["/family"];
const FAMILY_HOST = "family.kaosgdd.net";

function shouldUseBareShell(pathname) {
  return BARE_SHELL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isFamilyHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase() === FAMILY_HOST;
}

export default function AppShell({ children }) {
  const pathname = usePathname();

  if (isFamilyHost() || shouldUseBareShell(pathname)) {
    return <main className="appShellMain appShellMainBare">{children}</main>;
  }

  return (
    <>
      <AppShellHeightObserver />
      <header className="appShellTop">
        <div className="appShellTopInner">
          <div className="appHeaderLine">
            <AppHeaderTitle />
            <span className="appHeaderDot"> • </span>
            <span className="appHeaderSubtitle">{UI_STRINGS.APP_HEADER_SUBTITLE}</span>
          </div>
          <TopNav />
          <TopCaptureBar />
        </div>
      </header>

      <div className="appShellAttentionSlot">
        <AttentionBox />
      </div>

      <main className="appShellMain">{children}</main>
    </>
  );
}
