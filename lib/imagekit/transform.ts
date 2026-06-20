/**
 * ImageKit URL-based image transformations. ImageKit applies transforms via a
 * `tr` query parameter, so a "variant" is just a derived URL — no re-upload.
 * `fo-auto` enables smart (content-aware) cropping to the target box, and the
 * `e-*` effects are ImageKit's AI operations.
 */

export type VariantSpec = {
  key: string;
  label: string;
  transformation: string;
  width: number | null;
  height: number | null;
  /** AI effects (bg-remove, upscale) may need a paid ImageKit plan. */
  ai?: boolean;
};

/** Platform-sized smart crops. */
export const PLATFORM_VARIANT_SPECS: VariantSpec[] = [
  {
    key: "square",
    label: "Square 1:1 (feed)",
    transformation: "w-1080,h-1080,fo-auto",
    width: 1080,
    height: 1080,
  },
  {
    key: "portrait",
    label: "Portrait 4:5 (feed)",
    transformation: "w-1080,h-1350,fo-auto",
    width: 1080,
    height: 1350,
  },
  {
    key: "story",
    label: "Story / Reel / TikTok 9:16",
    transformation: "w-1080,h-1920,fo-auto",
    width: 1080,
    height: 1920,
  },
  {
    key: "landscape",
    label: "Landscape 16:9 (YouTube)",
    transformation: "w-1280,h-720,fo-auto",
    width: 1280,
    height: 720,
  },
];

/** AI effects applied without changing the aspect ratio. */
export const AI_TRANSFORM_OPS: VariantSpec[] = [
  {
    key: "bg-remove",
    label: "Remove background",
    transformation: "e-bgremove",
    width: null,
    height: null,
    ai: true,
  },
  {
    key: "upscale",
    label: "AI upscale 2x",
    transformation: "e-upscale",
    width: null,
    height: null,
    ai: true,
  },
];

export const ALL_VARIANT_SPECS: VariantSpec[] = [
  ...PLATFORM_VARIANT_SPECS,
  ...AI_TRANSFORM_OPS,
];

export function getVariantSpec(key: string): VariantSpec | undefined {
  return ALL_VARIANT_SPECS.find((s) => s.key === key);
}

/**
 * Build a transformed ImageKit URL. Chains onto any existing `tr` value (with
 * ImageKit's `:` step separator) so variants can stack.
 */
export function buildTransformUrl(
  srcUrl: string,
  transformation: string,
): string {
  const url = new URL(srcUrl);
  const existing = url.searchParams.get("tr");
  url.searchParams.set(
    "tr",
    existing ? `${existing}:${transformation}` : transformation,
  );
  return url.toString();
}
