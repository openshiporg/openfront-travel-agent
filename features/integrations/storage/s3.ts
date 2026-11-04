import { createHash, createHmac } from "node:crypto";

import { s3ForcePathStyle } from "../../keystone/lib/s3-storage";

export type ObjectMetadata = {
  key: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
};

export type SignedObjectRequest = {
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
};

type StorageConfig = {
  endpoint: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for private document storage`);
  return value;
}

function config(): StorageConfig {
  const endpoint = new URL(requiredEnvironment("S3_ENDPOINT"));
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname))) {
    throw new Error("S3_ENDPOINT must use HTTPS except for an explicit loopback development endpoint");
  }
  return {
    endpoint,
    bucket: requiredEnvironment("S3_BUCKET_NAME"),
    region: requiredEnvironment("S3_REGION"),
    accessKeyId: requiredEnvironment("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironment("S3_SECRET_ACCESS_KEY"),
  };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}
function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
function timestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
function objectUrl(storage: StorageConfig, key: string) {
  const url = new URL(storage.endpoint);
  const prefix = url.pathname.replace(/\/$/, "");
  const objectPath = key.split("/").map(encode).join("/");
  // Railway buckets accept only virtual-hosted addressing (bucket as subdomain).
  if (s3ForcePathStyle(storage.endpoint.href)) {
    url.pathname = `${prefix}/${encode(storage.bucket)}/${objectPath}`;
  } else {
    url.hostname = `${storage.bucket}.${url.hostname}`;
    url.pathname = `${prefix}/${objectPath}`;
  }
  return url;
}
function signingKey(secret: string, date: string, region: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), "s3"), "aws4_request");
}

export function assertObjectStorageConfigured(): void {
  void config();
}

export function signObjectRequest(
  method: "PUT" | "GET" | "HEAD",
  metadata: ObjectMetadata,
  expiresSeconds = 600,
  now = new Date(),
): SignedObjectRequest {
  const storage = config();
  const url = objectUrl(storage, metadata.key);
  const amzDate = timestamp(now);
  const date = amzDate.slice(0, 8);
  const credentialScope = `${date}/${storage.region}/s3/aws4_request`;
  const headers: Record<string, string> = method === "PUT" ? {
    "content-type": metadata.contentType,
    "x-amz-checksum-sha256": Buffer.from(metadata.checksumSha256, "hex").toString("base64"),
    "x-amz-meta-sha256": metadata.checksumSha256,
  } : method === "HEAD" ? { "x-amz-checksum-mode": "ENABLED" } : {};
  const signedHeaderNames = ["host", ...Object.keys(headers)].sort();
  const canonicalHeaders = signedHeaderNames.map(name => `${name}:${name === "host" ? url.host : headers[name].trim()}\n`).join("");
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${storage.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(Math.max(expiresSeconds, 60), 900)),
    "X-Amz-SignedHeaders": signedHeaderNames.join(";"),
  });
  const canonicalQuery = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderNames.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hash(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(storage.secretAccessKey, date, storage.region)).update(stringToSign).digest("hex");
  url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return {
    url: url.href,
    headers,
    expiresAt: new Date(now.getTime() + Math.min(Math.max(expiresSeconds, 60), 900) * 1000).toISOString(),
  };
}

const STORAGE_HEAD_TIMEOUT_MS = 8_000;

export async function verifyUploadedObject(metadata: ObjectMetadata): Promise<void> {
  const signed = signObjectRequest("HEAD", metadata, 120);
  const timeout = AbortSignal.timeout(STORAGE_HEAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(signed.url, { method: "HEAD", headers: signed.headers, redirect: "error", signal: timeout });
  } catch {
    const message = timeout.aborted
      ? "Object storage verification timed out. No version was issued; retry after storage is available."
      : "Object storage could not verify this upload. No version was issued; retry after storage is available.";
    throw new Error(message);
  }
  if (!response.ok) throw new Error("Uploaded object is not available for verification");
  const length = Number(response.headers.get("content-length"));
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const checksum = response.headers.get("x-amz-meta-sha256")?.trim().toLowerCase();
  const validatedChecksum = response.headers.get("x-amz-checksum-sha256")?.trim();
  const expectedChecksum = Buffer.from(metadata.checksumSha256, "hex").toString("base64");
  if (!Number.isSafeInteger(length) || length !== metadata.byteSize) throw new Error("Uploaded object size does not match the authorized version");
  if (contentType !== metadata.contentType.toLowerCase()) throw new Error("Uploaded object media type does not match the authorized version");
  if (checksum !== metadata.checksumSha256.toLowerCase() || validatedChecksum !== expectedChecksum) {
    throw new Error("Object storage did not validate the authorized SHA-256 checksum");
  }
}

/** True when every S3 setting is present and valid; never throws. */
export function isObjectStorageConfigured(): boolean {
  try { config(); return true } catch { return false }
}
