import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import manifest from "../app/manifest.js";
import { GET as getSharedFileMetadata } from "../app/api/shared-files/[id]/route.js";
import { GET as getSharedFileBytes } from "../app/api/shared-files/[id]/file/route.js";
import { POST as postShareTarget } from "../app/share-target/route.js";
import {
  createPendingShareFromFile,
  readPendingShareBytes,
  readPendingShareMetadata,
} from "../lib/pending-share-store.js";

async function withPendingShareDir(fn) {
  const previous = process.env.PENDING_SHARE_DIR;
  const dir = await mkdtemp(path.join(os.tmpdir(), "kaosgdd-share-test-"));
  process.env.PENDING_SHARE_DIR = dir;
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PENDING_SHARE_DIR;
    } else {
      process.env.PENDING_SHARE_DIR = previous;
    }
    await rm(dir, { recursive: true, force: true });
  }
}

function file(name = "scan.pdf", type = "application/pdf", body = "pdf-bytes") {
  return new File([body], name, { type });
}

function multipartRequest(files = []) {
  const form = new FormData();
  for (const item of files) {
    form.append("file", item);
  }
  return new Request("http://localhost/share-target", { method: "POST", body: form });
}

test("manifest includes single-file share_target", () => {
  const data = manifest();

  assert.equal(data.share_target.action, "/share-target");
  assert.equal(data.share_target.method, "POST");
  assert.equal(data.share_target.enctype, "multipart/form-data");
  assert.deepEqual(Object.keys(data.share_target.params), ["files"]);
  assert.equal(data.share_target.params.files.length, 1);
  assert.equal(data.share_target.params.files[0].name, "file");
  assert.deepEqual(data.share_target.params.files[0].accept, [
    "image/*",
    "application/pdf",
    "application/octet-stream",
  ]);
});

test("POST /share-target with one file creates pending attachment and redirects", async () => {
  await withPendingShareDir(async () => {
    const res = await postShareTarget(multipartRequest([file()]));

    assert.equal(res.status, 303);
    const location = res.headers.get("location");
    assert.match(location, /^http:\/\/localhost\/\?shared_file=/);
    const id = new URL(location).searchParams.get("shared_file");
    const metadata = await readPendingShareMetadata(id);
    const pending = await readPendingShareBytes(id);

    assert.equal(metadata.filename, "scan.pdf");
    assert.equal(metadata.content_type, "application/pdf");
    assert.equal(metadata.size, "pdf-bytes".length);
    assert.equal(pending.bytes.toString("utf8"), "pdf-bytes");
  });
});

test("POST /share-target with zero files rejects clearly", async () => {
  await withPendingShareDir(async () => {
    const res = await postShareTarget(multipartRequest([]));
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.deepEqual(data, { ok: false, error: "one shared file is required" });
  });
});

test("POST /share-target with multiple files rejects clearly", async () => {
  await withPendingShareDir(async () => {
    const res = await postShareTarget(multipartRequest([file("a.pdf"), file("b.pdf")]));
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.deepEqual(data, { ok: false, error: "only one shared file is supported" });
  });
});

test("pending shared attachment metadata and bytes can be loaded by API", async () => {
  await withPendingShareDir(async () => {
    const pending = await createPendingShareFromFile(file("photo.png", "image/png", "png-bytes"));

    const metadataRes = await getSharedFileMetadata(new Request("http://localhost/api/shared-files/" + pending.id), {
      params: { id: pending.id },
    });
    const metadataData = await metadataRes.json();
    const fileRes = await getSharedFileBytes(new Request("http://localhost/api/shared-files/" + pending.id + "/file"), {
      params: { id: pending.id },
    });

    assert.equal(metadataRes.status, 200);
    assert.equal(metadataData.ok, true);
    assert.equal(metadataData.item.filename, "photo.png");
    assert.equal(fileRes.status, 200);
    assert.equal(fileRes.headers.get("content-type"), "image/png");
    assert.equal(await fileRes.text(), "png-bytes");
  });
});

test("expired or missing pending shared attachment returns clear error", async () => {
  await withPendingShareDir(async () => {
    const pending = await createPendingShareFromFile(file(), { ttlMs: -1 });
    const expiredRes = await getSharedFileMetadata(new Request("http://localhost/api/shared-files/" + pending.id), {
      params: { id: pending.id },
    });
    const missingRes = await getSharedFileMetadata(new Request("http://localhost/api/shared-files/missing"), {
      params: { id: "missing" },
    });

    assert.equal(expiredRes.status, 404);
    assert.deepEqual(await expiredRes.json(), { ok: false, error: "shared file expired or missing" });
    assert.equal(missingRes.status, 404);
    assert.deepEqual(await missingRes.json(), { ok: false, error: "shared file expired or missing" });
  });
});

test("share-target stores pending file without creating permanent File item", async () => {
  await withPendingShareDir(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("share-target must not upload to backend");
    };
    try {
      const res = await postShareTarget(multipartRequest([file("pending.pdf")]));
      assert.equal(res.status, 303);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

