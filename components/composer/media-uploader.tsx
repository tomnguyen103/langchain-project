"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { saveUploadedMedia, type SavedMedia } from "@/app/(dashboard)/create/actions";
import { uploadToImageKit } from "@/lib/imagekit/client";

export function MediaUploader({
  value,
  onChange,
}: {
  value: SavedMedia[];
  onChange: (media: SavedMedia[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadToImageKit(file);
      const saved = await saveUploadedMedia({
        fileId: result.fileId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        width: result.width,
        height: result.height,
        size: result.size,
        mimeType: file.type,
      });
      onChange([...value, saved]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((media) => (
        <div
          key={media.id}
          className="relative size-20 overflow-hidden rounded-lg border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.thumbnailUrl ?? media.url}
            alt="Uploaded media"
            className="size-full object-cover"
          />
          <button
            type="button"
            aria-label="Remove media"
            onClick={() => onChange(value.filter((m) => m.id !== media.id))}
            className="bg-background/80 absolute top-1 right-1 rounded-full p-0.5"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      <label className="hover:bg-accent flex size-20 cursor-pointer items-center justify-center rounded-lg border border-dashed">
        {uploading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ImagePlus className="text-muted-foreground size-5" />
        )}
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFile}
          disabled={uploading}
        />
      </label>
    </div>
  );
}
