import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("family subdomain rewrites to Family routes without touching APIs or assets", async () => {
  const middlewareSource = await readSource("../proxy.js");

  assert.ok(middlewareSource.includes('const FAMILY_HOST = "family.kaosgdd.net";'));
  assert.ok(middlewareSource.includes("toFamilyInternalPath"));
  assert.ok(middlewareSource.includes('if (pathname === "/" || pathname === "/tasks") return "/family";'));
  assert.ok(middlewareSource.includes('if (pathname.startsWith("/tasks/")) return `/family${pathname}`;'));
  assert.ok(middlewareSource.includes("toFamilyPublicPath"));
  assert.ok(middlewareSource.includes('if (pathname === "/family/calendar") return "/calendar";'));
  assert.ok(middlewareSource.includes('if (pathname === "/family") return "/tasks";'));

  for (const route of ['"/calendar"', '"/tasks"', '"/roun"', '"/memo"', '"/settings"']) {
    assert.ok(middlewareSource.includes(route), `${route} should be available as a short Family subdomain path`);
  }

  assert.ok(middlewareSource.includes('if (pathname === "/family/settings") return "/settings";'));

  for (const passthrough of ['"/api/"', '"/_next/"', '"/favicon"', '"/manifest"']) {
    assert.ok(middlewareSource.includes(passthrough), `${passthrough} should not be rewritten under the Family subdomain`);
  }
  assert.ok(middlewareSource.includes('(pathname.startsWith("/family/") && /\\.[a-z0-9]+$/i.test(pathname))'));

  assert.ok(middlewareSource.includes('url.pathname === "/family" || url.pathname.startsWith("/family/")'));
  assert.ok(middlewareSource.includes("NextResponse.redirect(url)"), "Family host should canonicalize prefixed Family paths");
  assert.ok(middlewareSource.includes("NextResponse.rewrite(url)"), "Family host should use a route rewrite, not a browser redirect");
});
