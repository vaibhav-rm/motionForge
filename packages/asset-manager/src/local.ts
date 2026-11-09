import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import type { StorageDriver, StoredObject } from "./types.js";

/**
 * Local filesystem storage.
 *
 * Used for development and for single-node deployments. Keys are sanitised
 * so a malicious key can never escape the storage root — this is the
 * filesystem-restriction requirement from the security section.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";

  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /** Resolve a key to an absolute path, refusing to escape the root. */
  private resolveKey(key: string): string {
    const cleaned = normalize(key).replace(/^([.][.][/\\])+/, "");
    const absolute = resolve(this.root, cleaned);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new Error("Invalid storage key: path traversal is not permitted.");
    }
    return absolute;
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    contentType: string,
  ): Promise<StoredObject> {
    const absolute = this.resolveKey(key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, data);
    return {
      key,
      size: data.byteLength,
      contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    const absolute = this.resolveKey(key);
    return readFile(absolute);
  }

  async delete(key: string): Promise<void> {
    const absolute = this.resolveKey(key);
    await rm(absolute, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const absolute = this.resolveKey(key);
      await stat(absolute);
      return true;
    } catch {
      return false;
    }
  }

  url(key: string): string {
    // Served by the `/api/assets/[...path]` route in the web app.
    return `/api/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async list(prefix: string): Promise<string[]> {
    const absolute = this.resolveKey(prefix);
    const results: string[] = [];

    const walk = async (directory: string, relative: string) => {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const entryRelative = relative
          ? `${relative}/${entry.name}`
          : entry.name;
        if (entry.isDirectory()) {
          await walk(join(directory, entry.name), entryRelative);
        } else {
          results.push(entryRelative);
        }
      }
    };

    await walk(absolute, "");
    return results;
  }
}
