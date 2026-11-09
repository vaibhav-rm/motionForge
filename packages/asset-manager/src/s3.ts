import type { StorageDriver, StoredObject } from "./types.js";

/**
 * S3-compatible storage driver.
 *
 * Implements the AWS Signature V4 request signing directly so the package
 * has no runtime dependency on an SDK. This keeps the storage abstraction
 * portable: point it at AWS S3, Cloudflare R2, MinIO, Backblaze B2 or any
 * other S3-compatible service by changing configuration.
 */

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public base URL used to build asset URLs. */
  publicBaseUrl?: string;
  /** Path prefix applied to every key. */
  prefix?: string;
}

export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";

  private readonly config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  private objectKey(key: string): string {
    const prefix = this.config.prefix ? `${this.config.prefix.replace(/\/$/, "")}/` : "";
    return `${prefix}${key.replace(/^\//, "")}`;
  }

  private endpointUrl(): string {
    return this.config.endpoint.replace(/\/$/, "");
  }

  async put(
    key: string,
    data: Buffer | Uint8Array,
    contentType: string,
  ): Promise<StoredObject> {
    const objectKey = this.objectKey(key);
    const response = await this.send("PUT", objectKey, data, contentType);
    if (!response.ok) {
      throw new Error(
        `S3 upload failed with ${response.status}: ${await response.text()}`,
      );
    }
    return { key, size: data.byteLength, contentType };
  }

  async get(key: string): Promise<Buffer> {
    const objectKey = this.objectKey(key);
    const response = await this.send("GET", objectKey);
    if (!response.ok) {
      throw new Error(`S3 download failed with ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const objectKey = this.objectKey(key);
    const response = await this.send("DELETE", objectKey);
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 delete failed with ${response.status}.`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const objectKey = this.objectKey(key);
    const response = await this.send("HEAD", objectKey);
    return response.ok;
  }

  url(key: string): string {
    const objectKey = this.objectKey(key);
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${objectKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
    }
    return `${this.endpointUrl()}/${this.config.bucket}/${objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  async list(prefix: string): Promise<string[]> {
    const objectKey = this.objectKey(prefix);
    const response = await this.send("GET", objectKey);
    if (!response.ok) return [];
    const xml = await response.text();
    const keys: string[] = [];
    const pattern = /<Key>([^<]+)<\/Key>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
      keys.push(match[1]);
    }
    return keys;
  }

  /** Perform a signed request against the S3 endpoint. */
  private async send(
    method: "GET" | "PUT" | "DELETE" | "HEAD",
    objectKey: string,
    body?: Buffer | Uint8Array,
    contentType?: string,
  ): Promise<Response> {
    const url = new URL(
      `${this.endpointUrl()}/${this.config.bucket}/${objectKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
    );

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = await this.sha256Hex(body ?? new Uint8Array());

    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

    const canonicalRequest = [
      method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      await this.sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = await this.signingKey(dateStamp);
    const signature = await this.hmacHex(signingKey, stringToSign);

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (contentType) headers["Content-Type"] = contentType;

    return fetch(url, { method, headers, body: body as BodyInit | undefined });
  }

  /** Derive the SigV4 signing key for the current date. */
  private async signingKey(dateStamp: string): Promise<Uint8Array> {
    const key = await this.hmacBytes(
      new TextEncoder().encode(`AWS4${this.config.secretAccessKey}`),
      dateStamp,
    );
    const regionKey = await this.hmacBytes(key, this.config.region);
    const serviceKey = await this.hmacBytes(regionKey, "s3");
    return this.hmacBytes(serviceKey, "aws4_request");
  }

  private async hmacBytes(
    key: Uint8Array,
    message: string,
  ): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(message),
    );
    return new Uint8Array(signature);
  }

  private async hmacHex(key: Uint8Array, message: string): Promise<string> {
    const bytes = await this.hmacBytes(key, message);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private async sha256Hex(data: Buffer | Uint8Array | string): Promise<string> {
    const bytes =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : (data as BufferSource);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
}
