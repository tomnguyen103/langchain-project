import {
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { mediaTypeEnum } from "./enums";
import { timestamps } from "./_helpers";

/** An uploaded media asset, backed by ImageKit. */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    type: mediaTypeEnum("type").notNull(),
    imagekitFileId: text("imagekit_file_id"),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    width: integer("width"),
    height: integer("height"),
    durationSec: integer("duration_sec"),
    bytes: integer("bytes"),
    mimeType: text("mime_type"),
    transformations: jsonb("transformations"),
    // Set when this asset was derived from another (AI transform — Goal 8).
    sourceAssetId: uuid("source_asset_id").references(
      (): AnyPgColumn => mediaAssets.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (t) => [index("media_assets_user_idx").on(t.clerkUserId)],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
