"use client";

import { usePathname } from "next/navigation";
import AppHeaderTitle from "./AppHeaderTitle";
import TopCaptureBar from "./TopCaptureBar";
import AppShellHeightObserver from "./AppShellHeightObserver";
import AttentionBox from "./AttentionBox";
import TopNav from "./TopNav";
import { UI_STRINGS } from "../lib/strings";

function isFamilySurface(pathname) {
  return String(pathname || "").startsWith("/family");
}

export default function AppShellFrame({ children, initialFamilyHost = false }) {
  const pathname = usePathname();
  const familySurface = initialFamilyHost || isFamilySurface(pathname);

  return (
    <>
      {familySurface ? null : (
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
        </>
      )}

      <main className={`appShellMain${familySurface ? " appShellMainFamily" : ""}`}>{children}</main>
    </>
  );
}
