import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("fax inbox rows hide destructive actions behind expandable controls", async () => {
  const listSource = await readFile(new URL("../app/fax/page.js", import.meta.url), "utf8");
  const listClientSource = await readFile(new URL("../components/FaxInboxList.js", import.meta.url), "utf8");
  const detailSource = await readFile(new URL("../app/fax/[id]/page.js", import.meta.url), "utf8");
  const actionsSource = await readFile(new URL("../components/FaxInboxActions.js", import.meta.url), "utf8");

  assert.match(listSource, /<FaxInboxList items=\{items\} \/>/);
  assert.doesNotMatch(listClientSource, /<details/);
  assert.match(listClientSource, /const \[expandedId, setExpandedId\] = useState\(""\);/);
  assert.match(listClientSource, /aria-expanded=\{expanded\}/);
  assert.match(listClientSource, /onClick=\{\(\) => setExpandedId\(expanded \? "" : item\.id\)\}/);
  assert.match(listClientSource, /className="faxInboxExpandedActions"/);
  assert.match(listClientSource, /faxStatusClassName\(item\.fax_status\)/);
  assert.match(listClientSource, /<FaxInboxActions/);
  assert.match(listClientSource, /showOpenDownload/);
  assert.match(listClientSource, /pdfAvailable=\{Boolean\(item\.pdf_available\)\}/);
  assert.match(detailSource, /<FaxInboxActions/);
  assert.match(actionsSource, /showOpenDownload = false/);
  assert.match(actionsSource, /pdfAvailable = false/);
  assert.match(actionsSource, /href=\{`\/api\/fax\/\$\{faxId\}\/open`\}/);
  assert.match(actionsSource, /href=\{`\/api\/fax\/\$\{faxId\}\/open\?download=1`\}/);
  assert.match(actionsSource, /Save to Files/);
  assert.match(actionsSource, /Delete/);
  assert.match(actionsSource, /dispatchAppStatusChanged\(\{ source: "fax", action: "save-to-files"/);
  assert.match(actionsSource, /dispatchAppStatusChanged\(\{ source: "fax", action: "delete"/);
});

test("fax statuses use secondary color pills beside direction", async () => {
  const listSource = await readFile(new URL("../components/FaxInboxList.js", import.meta.url), "utf8");
  const listCss = await readFile(new URL("../app/styles/lists.css", import.meta.url), "utf8");

  assert.match(listSource, /if \(status === "sent"\) return "faxStatusPill faxStatusPillSent";/);
  assert.match(listSource, /if \(status === "failed"\) return "faxStatusPill faxStatusPillFailed";/);
  assert.match(listSource, /<span className="eventSystemBadge eventObservanceBadge">\{badgeLabel\(item\)\}<\/span>\s*<span className=\{faxStatusClassName\(item\.fax_status\)\}>\{item\.fax_status\}<\/span>/);
  assert.match(listCss, /\.faxStatusPillSent\s*\{/);
  assert.match(listCss, /\.faxStatusPillSent\s*\{[\s\S]*?rgba\(166,\s*227,\s*161,\s*0\.18\)/);
  assert.match(listCss, /\.faxStatusPillFailed\s*\{/);
  assert.match(listCss, /\.faxStatusPillFailed\s*\{[\s\S]*?rgba\(243,\s*139,\s*168,\s*0\.16\)/);
});

test("fax save and delete actions use dedicated API routes", async () => {
  const actionsSource = await readFile(new URL("../components/FaxInboxActions.js", import.meta.url), "utf8");
  const deleteRoute = await readFile(new URL("../app/api/fax/[id]/route.js", import.meta.url), "utf8");
  const saveRoute = await readFile(new URL("../app/api/fax/[id]/save-to-files/route.js", import.meta.url), "utf8");

  assert.match(actionsSource, /fetch\(`\/api\/fax\/\$\{faxId\}\/save-to-files`, \{ method: "POST" \}\)/);
  assert.match(actionsSource, /fetch\(`\/api\/fax\/\$\{faxId\}`, \{ method: "DELETE" \}\)/);
  assert.match(deleteRoute, /export async function DELETE/);
  assert.match(deleteRoute, /base \+ "\/fax\/" \+ id/);
  assert.match(saveRoute, /export async function POST/);
  assert.match(saveRoute, /base \+ "\/fax\/" \+ id \+ "\/save-to-files"/);
});
