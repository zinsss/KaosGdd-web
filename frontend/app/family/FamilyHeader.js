"use client";

import Link from "next/link";

const FAMILY_NAV_ITEMS = [
  { key: "memo", href: "/family/memo", label: "메모장" },
  { key: "calendar", href: "/family/calendar", label: "달력" },
  { key: "home", href: "/family", label: "할 일" },
];

export default function FamilyHeader({ active = "home" }) {
  return (
    <header className="familyHeader">
      <h1>가족</h1>
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
