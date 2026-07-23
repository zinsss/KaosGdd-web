"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FAMILY_NAV_ITEMS = [
  { key: "calendar", familyHref: "/calendar", mainHref: "/family/calendar2", label: "달력" },
  { key: "home", familyHref: "/", mainHref: "/family", label: "할일" },
  { key: "roun", familyHref: "/roun", mainHref: "/family/roun", label: "로운이" },
  { key: "memo", familyHref: "/memo", mainHref: "/family/memo", label: "메모장" },
  { key: "settings", familyHref: "/settings", mainHref: "/family/settings", label: "설정" },
];

export default function FamilyHeader({ active = "home" }) {
  const [isFamilyHost, setIsFamilyHost] = useState(false);

  useEffect(() => {
    setIsFamilyHost(window.location.hostname === "family.kaosgdd.net");
  }, []);

  return (
    <header className="familyHeader">
      <Link className="familyLogoLink" href="/family" aria-label="가족 홈">
        <span className="familyTextLogo">로운이와 나</span>
      </Link>
      <nav className="familyHomeNav" aria-label="가족 화면">
        {FAMILY_NAV_ITEMS.map((item) => (
          <Link
            className={`familyHomeNavLink${active === item.key ? " familyHomeNavLinkActive" : ""}`}
            href={isFamilyHost ? item.familyHref : item.mainHref}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
