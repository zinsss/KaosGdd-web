"use client";

import Link from "next/link";

function isInternalHref(href) {
  return typeof href === "string" && href.startsWith("/");
}

export default function LinkedItemsBlock({ links }) {
  if (!Array.isArray(links) || links.length === 0) return null;

  return (
    <div className="detailReadRow">
      <div className="detailReadLabel">Links</div>
      <div className="detailReadContent withDivider">
        <ul className="linkedItemsList">
          {links.map((link) => {
            const marker = link?.marker || "?";
            const label = link?.title || "missing item";
            const key = String(link?.id || `${marker}:${label}`);
            const href = link?.href;
            return (
              <li key={key} className="linkedItemRow">
                <span className="linkedItemBullet" aria-hidden="true">
                  -
                </span>
                <span className="linkedItemType">[{marker}]</span>
                <span className="linkedItemText">
                  {href ? (
                    isInternalHref(href) ? (
                      <Link className="taskLink" href={href}>
                        {label}
                      </Link>
                    ) : (
                      <a className="taskLink" href={href}>
                        {label}
                      </a>
                    )
                  ) : (
                    <span>{label}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
