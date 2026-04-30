import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { getGcpClientOptions } from "@/lib/gcp/credentials";

export interface UploadToGcsInput {
  buffer: Buffer;
  fileName?: string;
  contentType: string;
  signedUrlExpiresInSeconds?: number;
}

export interface UploadToGcsResult {
  path: string;
  url: string;
}

export interface GcsHistoryItem {
  name: string;
  path: string;
  url: string;
  createdAt: string | null;
}

export interface DownloadFromGcsResult {
  buffer: Buffer;
  contentType: string;
}

let storageClient: Storage | null = null;

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage(getGcpClientOptions());
  }
  return storageClient;
}

function getAudioBucketName(): string {
  const bucketName = process.env.GCS_BUCKET_NAME?.trim();
  if (!bucketName) {
    throw new Error("Missing GCS_BUCKET_NAME environment variable");
  }
  return bucketName;
}

function getAudioPrefix(): string {
  const raw = process.env.GCS_AUDIO_PREFIX?.trim() ?? "tts-audio";
  const withoutSlashes = raw.replace(/^\/+|\/+$/g, "");
  return withoutSlashes ? `${withoutSlashes}/` : "";
}

function isPathAllowed(path: string): boolean {
  const prefix = getAudioPrefix();
  if (!prefix) return true;
  return path.startsWith(prefix);
}

function encodePathForPublicUrl(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function getPublicGcsUrl(bucketName: string, path: string): string {
  return `https://storage.googleapis.com/${bucketName}/${encodePathForPublicUrl(path)}`;
}

export async function uploadAudioToGcs({
  buffer,
  fileName,
  contentType,
  signedUrlExpiresInSeconds = 60 * 60 * 24,
}: UploadToGcsInput): Promise<UploadToGcsResult> {
  const bucketName = getAudioBucketName();
  const objectName = fileName ?? `${randomUUID()}.mp3`;
  const path = `${getAudioPrefix()}${objectName}`;

  const bucket = getStorage().bucket(bucketName);
  const file = bucket.file(path);

  console.info("[gcs/upload] Starting upload", {
    bucket: bucketName,
    path,
    bytes: buffer.length,
    contentType,
  });

  await file.save(buffer, {
    resumable: buffer.length >= 5 * 1024 * 1024,
    validation: "crc32c",
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + signedUrlExpiresInSeconds * 1000,
  });

  console.info("[gcs/upload] Upload completed", {
    path,
    signedUrlExpiresInSeconds,
  });
  return { path, url };
}

export async function downloadAudioFromGcs(path: string): Promise<DownloadFromGcsResult> {
  const normalizedPath = path.replace(/^\/+/, "").trim();
  if (!normalizedPath) {
    throw new Error("Missing GCS object path");
  }
  if (!isPathAllowed(normalizedPath)) {
    throw new Error("Invalid GCS object path");
  }

  const bucket = getStorage().bucket(getAudioBucketName());
  const file = bucket.file(normalizedPath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("Audio file not found");
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata().catch(() => [undefined]);
  return {
    buffer,
    contentType: metadata?.contentType ?? "audio/mpeg",
  };
}

export async function listRecentAudioFromGcs(limit = 100): Promise<GcsHistoryItem[]> {
  const bucketName = getAudioBucketName();
  const prefix = getAudioPrefix();
  const bucket = getStorage().bucket(bucketName);

  console.info("[gcs/history] Listing audio files", { bucket: bucketName, prefix, limit });

  const [files] = await bucket.getFiles({
    prefix,
    autoPaginate: false,
    maxResults: limit,
  });

  const withMetadata = await Promise.all(
    files.map(async (file) => {
      const [metadata] = await file.getMetadata().catch(() => [undefined]);
      const createdAt = metadata?.timeCreated ?? null;
      return {
        name: file.name.split("/").pop() ?? file.name,
        path: file.name,
        createdAt,
        url: getPublicGcsUrl(bucketName, file.name),
      };
    })
  );

  withMetadata.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return withMetadata.slice(0, limit);
}
