"use client";

import Link from "next/link";

function internalPathFromHref(href) {
  if (typeof href !== "string") return "";
  if (href.startsWith("/")) return href;
  if (typeof window === "undefined") return "";

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
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
            const internalHref = internalPathFromHref(href);
            return (
              <li key={key} className="linkedItemRow">
                <span className="linkedItemBullet" aria-hidden="true">
                  -
                </span>
                <span className="linkedItemType">[{marker}]</span>
                <span className="linkedItemText">
                  {href ? (
                    internalHref ? (
                      <Link className="taskLink" href={internalHref}>
                        {label}
                      </Link>
                    ) : (
                      <a className="taskLink" href={href} rel="noreferrer">
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
