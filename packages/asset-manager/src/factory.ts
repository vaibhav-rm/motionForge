import { LocalStorageDriver } from "./local.js";
import { S3StorageDriver } from "./s3.js";
import type { StorageDriver } from "./types.js";

/**
 * Storage driver factory.
 *
 * The driver is chosen by configuration so the same code runs against local
 * disk in development and object storage in production.
 */

export interface StorageConfig {
  driver?: string;
  localRoot?: string;
  s3?: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl?: string;
    prefix?: string;
  };
}

/** Build the storage driver described by a configuration. */
export function createStorage(config: StorageConfig = {}): StorageDriver {
  const driver = (config.driver ?? process.env.STORAGE_DRIVER ?? "local").toLowerCase();

  if (driver === "s3") {
    const s3 = config.s3 ?? {
      endpoint: process.env.S3_ENDPOINT ?? "",
      region: process.env.S3_REGION ?? "auto",
      bucket: process.env.S3_BUCKET ?? "",
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
      prefix: process.env.S3_PREFIX,
    };

    if (!s3.endpoint || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error(
        "STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
      );
    }

    return new S3StorageDriver(s3);
  }

  const root =
    config.localRoot ??
    process.env.STORAGE_LOCAL_ROOT ??
    "./storage";
  return new LocalStorageDriver(root);
}

let cached: StorageDriver | null = null;

/** Get the shared storage driver instance. */
export function getStorage(): StorageDriver {
  if (!cached) cached = createStorage();
  return cached;
}

/** Replace the shared storage driver (used in tests). */
export function setStorage(driver: StorageDriver): void {
  cached = driver;
}
