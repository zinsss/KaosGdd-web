import { NextResponse } from "next/server";

const FAMILY_HOST = "family.kaosgdd.net";
const FAMILY_ROUTE_PREFIXES = ["/calendar", "/tasks", "/roun", "/memo"];

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
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/screenshots/")
  );
}

function shouldRewriteToFamily(pathname) {
  return pathname === "/" || FAMILY_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request) {
  if (!isFamilyHost(request)) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (isPassthroughPath(url.pathname) || url.pathname.startsWith("/family")) {
    return NextResponse.next();
  }

  if (!shouldRewriteToFamily(url.pathname)) {
    return NextResponse.next();
  }

  url.pathname = url.pathname === "/" ? "/family" : `/family${url.pathname}`;
  return NextResponse.rewrite(url);
}
