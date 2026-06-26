import type { MediaType } from "@/db/schema";

export const MEDIA_UPLOAD_FOLDER = "/socialflow";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function quotedList(values: Iterable<string>): string {
  return [...values].map((value) => `"${value}"`).join(",");
}

export function deriveMediaType(mimeType?: string | null): MediaType {
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType === "image/gif") return "gif";
  return "image";
}

export function mediaMaxBytesFor(mimeType?: string | null): number | null {
  if (!mimeType) return null;
  if (ALLOWED_IMAGE_TYPES.has(mimeType)) return MAX_IMAGE_BYTES;
  if (ALLOWED_VIDEO_TYPES.has(mimeType)) return MAX_VIDEO_BYTES;
  return null;
}

export function validateMediaUpload(input: {
  mimeType?: string | null;
  size?: number | null;
}): void {
  const maxBytes = mediaMaxBytesFor(input.mimeType);
  if (!maxBytes) {
    throw new Error("Upload an image or video in a supported format.");
  }

  const size = input.size;
  if (!Number.isFinite(size) || size == null || size <= 0) {
    throw new Error("Upload size is required.");
  }
  if (size > maxBytes) {
    throw new Error(
      `File is too large. Images must be ${MAX_IMAGE_BYTES / 1024 / 1024}MB or less and videos must be ${MAX_VIDEO_BYTES / 1024 / 1024}MB or less.`,
    );
  }
}

export function imageKitUploadChecks(): string {
  // ImageKit validates this server-side before accepting the client upload.
  const imageTypes = quotedList(ALLOWED_IMAGE_TYPES);
  const videoTypes = quotedList(ALLOWED_VIDEO_TYPES);
  const maxImageMb = MAX_IMAGE_BYTES / 1024 / 1024;
  const maxVideoMb = MAX_VIDEO_BYTES / 1024 / 1024;
  return [
    `"request.folder":"${MEDIA_UPLOAD_FOLDER}"`,
    `(("file.mime" IN [${imageTypes}] AND "file.size" <= "${maxImageMb}mb") OR ("file.mime" IN [${videoTypes}] AND "file.size" <= "${maxVideoMb}mb"))`,
  ].join(" AND ");
}
