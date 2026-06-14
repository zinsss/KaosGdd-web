"use client";

import Link from "next/link";

const FAMILY_NAV_ITEMS = [
  { key: "memo", href: "/family/memo", label: "뭐라꼬?" },
  { key: "calendar", href: "/family/calendar", label: "은제?" },
  { key: "home", href: "/family", label: "모하꼬?" },
];

export default function FamilyHeader({ active = "home" }) {
  return (
    <header className="familyHeader">
      <h1>우야노 우야꼬</h1>
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
