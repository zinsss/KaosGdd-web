"use client";

import Link from "next/link";

const FAMILY_NAV_ITEMS = [
  { key: "home", href: "/family", label: "모하노" },
  { key: "memo", href: "/family/memo", label: "모라노" },
];

export default function FamilyHeader({ active = "home" }) {
  return (
    <header className="familyHeader">
      <h1>우짜노우짤꼬</h1>
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
