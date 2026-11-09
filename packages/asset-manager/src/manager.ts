import { slugify } from "@motionforge/shared";
import type { AssetKind, StorageDriver } from "./types.js";

/**
 * Asset manager.
 *
 * Handles the project-scoped lifecycle of uploaded media: validation,
 * naming, storage and URL resolution. The AI can query the asset list to
 * decide where an uploaded logo or image should be used.
 */

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  size: number;
  /** Storage key. */
  storagePath: string;
  /** URL usable by the preview and the renderer. */
  url: string;
  width: number | null;
  height: number | null;
  durationInFrames: number | null;
  createdAt: string;
}

export interface UploadInput {
  projectId: string;
  filename: string;
  mimeType: string;
  size: number;
  data: Buffer | Uint8Array;
  kind: AssetKind;
}

/** Build a safe, unique storage key for an upload. */
export function buildStorageKey(
  projectId: string,
  filename: string,
  assetId: string,
): string {
  const base = slugify(filename.replace(/\.[^.]+$/, "")) || "asset";
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
    : "";
  return `projects/${projectId}/${assetId}-${base}${extension}`;
}

/** Store an uploaded asset. */
export async function storeAsset(
  storage: StorageDriver,
  input: UploadInput,
  assetId: string,
): Promise<AssetRecord> {
  const storagePath = buildStorageKey(input.projectId, input.filename, assetId);
  const stored = await storage.put(storagePath, input.data, input.mimeType);

  return {
    id: assetId,
    projectId: input.projectId,
    name: input.filename,
    kind: input.kind,
    mimeType: stored.contentType,
    size: stored.size,
    storagePath,
    url: storage.url(storagePath),
    width: null,
    height: null,
    durationInFrames: null,
    createdAt: new Date().toISOString(),
  };
}

/** Delete an asset's stored object. */
export async function removeAsset(
  storage: StorageDriver,
  storagePath: string,
): Promise<void> {
  await storage.delete(storagePath);
}

/** Convert an asset record into the shape embedded in a project. */
export function toProjectAsset(asset: AssetRecord) {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.kind,
    mimeType: asset.mimeType,
    url: asset.url,
    width: asset.width,
    height: asset.height,
    durationInFrames: asset.durationInFrames,
    size: asset.size,
  };
}
