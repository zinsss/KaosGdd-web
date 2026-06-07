import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("fax inbox rows expose Save to Files and Delete actions", async () => {
  const listSource = await readFile(new URL("../app/fax/page.js", import.meta.url), "utf8");
  const detailSource = await readFile(new URL("../app/fax/[id]/page.js", import.meta.url), "utf8");
  const actionsSource = await readFile(new URL("../components/FaxInboxActions.js", import.meta.url), "utf8");

  assert.match(listSource, /<FaxInboxActions/);
  assert.match(detailSource, /<FaxInboxActions/);
  assert.match(actionsSource, /Save to Files/);
  assert.match(actionsSource, /Delete/);
  assert.match(actionsSource, /dispatchAppStatusChanged\(\{ source: "fax", action: "save-to-files"/);
  assert.match(actionsSource, /dispatchAppStatusChanged\(\{ source: "fax", action: "delete"/);
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
