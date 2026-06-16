"use client";

import Link from "next/link";

const FAMILY_NAV_ITEMS = [
  { key: "calendar", href: "/family/calendar", label: "달력" },
  { key: "home", href: "/family", label: "할일" },
  { key: "roun", href: "/family/roun", label: "로운이" },
  { key: "memo", href: "/family/memo", label: "메모장" },
];

export default function FamilyHeader({ active = "home" }) {
  return (
    <header className="familyHeader">
      <Link className="familyLogoLink" href="/family" aria-label="가족 홈">
        <span className="familyTextLogo">로운이와 나</span>
      </Link>
      <nav className="familyHomeNav" aria-label="가족 화면">
        {FAMILY_NAV_ITEMS.map((item) => (
          <Link
            className={`familyHomeNavLink${active === item.key ? " familyHomeNavLinkActive" : ""}`}
            href={item.href}
            key={item.key}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
