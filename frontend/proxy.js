import { NextResponse } from "next/server";

const FAMILY_HOST = "family.kaosgdd.net";
const FAMILY_ROUTE_PREFIXES = ["/calendar", "/calendar2", "/tasks", "/roun", "/memo", "/settings"];

function isFamilyHost(request) {
  const host = request.headers.get("host") || "";
  return host.split(":")[0].toLowerCase() === FAMILY_HOST;
}

function isPassthroughPath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    (pathname.startsWith("/family/") && /\.[a-z0-9]+$/i.test(pathname)) ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/screenshots/")
  );
}

function shouldRewriteToFamily(pathname) {
  return pathname === "/" || FAMILY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function toFamilyInternalPath(pathname) {
  if (pathname === "/" || pathname === "/tasks") return "/family";
  if (pathname.startsWith("/tasks/")) return `/family${pathname}`;
  return `/family${pathname}`;
}

function toFamilyPublicPath(pathname) {
  if (pathname === "/family") return "/tasks";
  if (pathname === "/family/calendar") return "/calendar";
  if (pathname.startsWith("/family/calendar/")) return pathname.slice("/family".length);
  if (pathname === "/family/calendar2") return "/calendar2";
  if (pathname.startsWith("/family/calendar2/")) return pathname.slice("/family".length);
  if (pathname === "/family/roun") return "/roun";
  if (pathname.startsWith("/family/roun/")) return pathname.slice("/family".length);
  if (pathname === "/family/memo") return "/memo";
  if (pathname.startsWith("/family/memo/")) return pathname.slice("/family".length);
  if (pathname === "/family/settings") return "/settings";
  if (pathname.startsWith("/family/settings/")) return pathname.slice("/family".length);
  if (pathname.startsWith("/family/tasks/")) return pathname.slice("/family".length);
  return pathname;
}

export function proxy(request) {
  if (!isFamilyHost(request)) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (isPassthroughPath(url.pathname)) {
    return NextResponse.next();
  }

  if (url.pathname === "/family" || url.pathname.startsWith("/family/")) {
    url.pathname = toFamilyPublicPath(url.pathname);
    return NextResponse.redirect(url);
  }

  if (!shouldRewriteToFamily(url.pathname)) {
    return NextResponse.next();
  }

  url.pathname = toFamilyInternalPath(url.pathname);
  return NextResponse.rewrite(url);
}
