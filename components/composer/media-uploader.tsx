"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  generateMediaVariants,
  saveUploadedMedia,
  type SavedMedia,
} from "@/app/(dashboard)/create/actions";
import {
  AI_TRANSFORM_OPS,
  PLATFORM_VARIANT_SPECS,
} from "@/lib/imagekit/transform";
import { uploadToImageKit } from "@/lib/imagekit/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MediaUploader({
  value,
  onChange,
}: {
  value: SavedMedia[];
  onChange: Dispatch<SetStateAction<SavedMedia[]>>;
}) {
  const [uploading, setUploading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

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
      onChange((prev) => [...prev, saved]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function generate(assetId: string, specKey: string) {
    setGeneratingId(assetId);
    try {
      const variants = await generateMediaVariants(assetId, [specKey]);
      onChange((prev) => [...prev, ...variants]);
      toast.success("Variant added.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't generate variant.",
      );
    } finally {
      setGeneratingId(null);
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
            onClick={() =>
              onChange((prev) => prev.filter((m) => m.id !== media.id))
            }
            className="bg-background/80 absolute top-1 right-1 rounded-full p-0.5"
          >
            <X className="size-3" />
          </button>

          {media.type === "image" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Generate variants"
                  disabled={generatingId === media.id}
                  className="bg-background/80 absolute bottom-1 right-1 rounded-full p-0.5"
                >
                  {generatingId === media.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Platform sizes</DropdownMenuLabel>
                {PLATFORM_VARIANT_SPECS.map((spec) => (
                  <DropdownMenuItem
                    key={spec.key}
                    onClick={() => generate(media.id, spec.key)}
                  >
                    {spec.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>AI effects</DropdownMenuLabel>
                {AI_TRANSFORM_OPS.map((spec) => (
                  <DropdownMenuItem
                    key={spec.key}
                    onClick={() => generate(media.id, spec.key)}
                  >
                    {spec.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
