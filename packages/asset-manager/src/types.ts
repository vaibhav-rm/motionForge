import { z } from "zod";

/**
 * Asset storage abstraction.
 *
 * The application never talks to a filesystem or an object store directly.
 * Everything goes through the `StorageDriver` interface, so switching from
 * local development storage to S3-compatible production storage is a
 * configuration change rather than a code change.
 */

export const AssetKindSchema = z.enum(["image", "video", "audio", "other"]);
export type AssetKind = z.infer<typeof AssetKindSchema>;

export interface StoredObject {
  /** Key within the storage namespace. */
  key: string;
  /** Absolute size in bytes. */
  size: number;
  /** MIME type. */
  contentType: string;
}

export interface StorageDriver {
  readonly name: string;
  /** Write a buffer and return its key. */
  put(key: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredObject>;
  /** Read an object back. */
  get(key: string): Promise<Buffer>;
  /** Delete an object. Missing objects are not an error. */
  delete(key: string): Promise<void>;
  /** Whether an object exists. */
  exists(key: string): Promise<boolean>;
  /** A URL the browser or renderer can load the object from. */
  url(key: string): string;
  /** List keys under a prefix. */
  list(prefix: string): Promise<string[]>;
}

/** MIME types accepted for upload, keyed by category. */
export const ALLOWED_MIME_TYPES: Record<AssetKind, string[]> = {
  image: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/avif",
  ],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
  audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac", "audio/mp4"],
  other: [],
};

/** Maximum upload size in bytes (100 MB). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Detect the asset category from a MIME type. */
export function kindForMimeType(mimeType: string): AssetKind | null {
  const normalised = mimeType.toLowerCase();
  for (const [kind, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(normalised)) return kind as AssetKind;
  }
  return null;
}

/** Validate an upload's MIME type and size. */
export function validateUpload(input: {
  mimeType: string;
  size: number;
}): { ok: true; kind: AssetKind } | { ok: false; error: string } {
  const kind = kindForMimeType(input.mimeType);
  if (!kind) {
    return {
      ok: false,
      error: `Unsupported file type "${input.mimeType}". Supported types: ${Object.values(
        ALLOWED_MIME_TYPES,
      )
        .flat()
        .join(", ")}.`,
    };
  }

  if (input.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is too large (${Math.round(input.size / 1024 / 1024)} MB). The limit is ${Math.round(
        MAX_UPLOAD_BYTES / 1024 / 1024,
      )} MB.`,
    };
  }

  if (input.size === 0) {
    return { ok: false, error: "The uploaded file is empty." };
  }

  return { ok: true, kind };
}
