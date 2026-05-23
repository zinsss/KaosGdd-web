import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TTL_MS = 60 * 60 * 1000;

function pendingShareDir() {
  return process.env.PENDING_SHARE_DIR || "/tmp/kaosgdd-pending-shares";
}

function safeId(id) {
  const clean = String(id || "").trim();
  return /^[a-f0-9-]{36}$/i.test(clean) ? clean : "";
}

function pathsFor(id) {
  const cleanId = safeId(id);
  if (!cleanId) return null;
  const base = path.join(pendingShareDir(), cleanId);
  return {
    dataPath: `${base}.bin`,
    metaPath: `${base}.json`,
  };
}

function isExpired(metadata, now = Date.now()) {
  return Number(metadata?.expires_at_ms || 0) <= now;
}

async function ensureDir() {
  await mkdir(pendingShareDir(), { recursive: true, mode: 0o700 });
}

export async function cleanupExpiredPendingShares(now = Date.now()) {
  await ensureDir();
  const entries = await readdir(pendingShareDir(), { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const metaPath = path.join(pendingShareDir(), entry.name);
        try {
          const metadata = JSON.parse(await readFile(metaPath, "utf8"));
          if (!isExpired(metadata, now)) return;
          const id = safeId(metadata.id);
          if (id) {
            await deletePendingShare(id);
          } else {
            await rm(metaPath, { force: true });
          }
        } catch {
          await rm(metaPath, { force: true });
        }
      }),
  );
}

export async function createPendingShareFromFile(file, { ttlMs = DEFAULT_TTL_MS } = {}) {
  await cleanupExpiredPendingShares();

  const id = randomUUID();
  const paths = pathsFor(id);
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = String(file.name || "").trim() || "shared-file";
  const contentType = String(file.type || "").trim() || "application/octet-stream";
  const now = Date.now();
  const metadata = {
    id,
    filename,
    content_type: contentType,
    size: bytes.length,
    created_at_ms: now,
    expires_at_ms: now + ttlMs,
  };

  await ensureDir();
  await writeFile(paths.dataPath, bytes, { mode: 0o600 });
  await writeFile(paths.metaPath, JSON.stringify(metadata), { mode: 0o600 });
  return metadata;
}

export async function readPendingShareMetadata(id) {
  await cleanupExpiredPendingShares();
  const paths = pathsFor(id);
  if (!paths) return null;

  try {
    const metadata = JSON.parse(await readFile(paths.metaPath, "utf8"));
    await stat(paths.dataPath);
    if (isExpired(metadata)) {
      await deletePendingShare(id);
      return null;
    }
    return metadata;
  } catch {
    return null;
  }
}

export async function readPendingShareBytes(id) {
  const metadata = await readPendingShareMetadata(id);
  if (!metadata) return null;
  const paths = pathsFor(id);
  if (!paths) return null;
  try {
    return {
      metadata,
      bytes: await readFile(paths.dataPath),
    };
  } catch {
    return null;
  }
}

export async function deletePendingShare(id) {
  const paths = pathsFor(id);
  if (!paths) return false;
  await Promise.all([
    rm(paths.dataPath, { force: true }),
    rm(paths.metaPath, { force: true }),
  ]);
  return true;
}

