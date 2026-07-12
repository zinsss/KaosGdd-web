"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FAMILY_NAV_ITEMS = [
  { key: "calendar", familyHref: "/calendar", mainHref: "/family/calendar", label: "달력" },
  { key: "home", familyHref: "/tasks", mainHref: "/family", label: "할일" },
  { key: "roun", familyHref: "/roun", mainHref: "/family/roun", label: "로운이" },
  { key: "memo", familyHref: "/memo", mainHref: "/family/memo", label: "메모장" },
  { key: "settings", familyHref: "/settings", mainHref: "/family/settings", label: "설정" },
];

function readFamilyHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase() === "family.kaosgdd.net";
}

export default function FamilyHeader({ active = "home" }) {
  const [familyHost, setFamilyHost] = useState(false);

  useEffect(() => {
    setFamilyHost(readFamilyHost());
  }, []);

  const homeHref = familyHost ? "/tasks" : "/family";

  return (
    <header className="familyHeader">
      <Link className="familyLogoLink" href={homeHref} aria-label="가족 홈">
        <span className="familyTextLogo">로운이와 나</span>
      </Link>
      <nav className="familyHomeNav" aria-label="가족 화면">
        {FAMILY_NAV_ITEMS.map((item) => {
          const href = familyHost ? item.familyHref : item.mainHref;
          return (
            <Link
              className={`familyHomeNavLink${active === item.key ? " familyHomeNavLinkActive" : ""}`}
              href={href}
              key={item.key}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
