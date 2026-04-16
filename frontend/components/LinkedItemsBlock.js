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
                {href ? (
                  isInternalHref(href) ? (
                    <Link className="taskLink" href={href}>
                      [{marker}] {label}
                    </Link>
                  ) : (
                    <a className="taskLink" href={href}>
                      [{marker}] {label}
                    </a>
                  )
                ) : (
                  <span>
                    [{marker}] {label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
