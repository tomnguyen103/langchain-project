export type ImageKitUploadResult = {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  height?: number;
  width?: number;
  size?: number;
  fileType?: string;
};

/** Upload a file directly from the browser to ImageKit using signed params. */
export async function uploadToImageKit(
  file: File,
): Promise<ImageKitUploadResult> {
  const authRes = await fetch("/api/imagekit/auth");
  if (!authRes.ok) {
    throw new Error("Could not authorize upload");
  }
  const { token, expire, signature, publicKey } = await authRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("fileName", file.name);
  form.append("publicKey", publicKey);
  form.append("token", token);
  form.append("expire", String(expire));
  form.append("signature", signature);
  form.append("useUniqueFileName", "true");
  form.append("folder", "/socialflow");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? "Upload failed");
  }
  return res.json();
}
