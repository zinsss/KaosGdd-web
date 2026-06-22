import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("notes list links and detail lookup use the route note id", async () => {
  const listSource = await readSource("../app/notes/NotesPageClient.js");
  const detailSource = await readSource("../app/notes/[id]/page.js");

  assert.ok(listSource.includes('href={`/notes/${item.id}`}'));
  assert.ok(listSource.includes("key={item.id}"));
  assert.match(detailSource, /export default async function NoteDetailPage\(\{ params \}\)/);
  assert.match(detailSource, /const \{ id \} = await params;/);
  assert.match(detailSource, /const result = await getNote\(id\);/);
  assert.match(detailSource, /const rawResult = result\.ok \? await getNoteRaw\(id\) : \{ ok: false, raw: "" \};/);
  assert.doesNotMatch(detailSource, /params\.id/);
});

test("notes dynamic API routes await params before proxying ids", async () => {
  const noteRouteSource = await readSource("../app/api/notes/[id]/route.js");
  const rawRouteSource = await readSource("../app/api/notes/[id]/raw/route.js");

  assert.match(noteRouteSource, /const \{ id \} = await context\.params;/);
  assert.match(rawRouteSource, /export async function GET\(_request, context\) \{[\s\S]*?const \{ id \} = await context\.params;/);
  assert.match(rawRouteSource, /export async function PATCH\(request, context\) \{[\s\S]*?const \{ id \} = await context\.params;/);
  assert.doesNotMatch(`${noteRouteSource}\n${rawRouteSource}`, /context\.params\.id/);
});
