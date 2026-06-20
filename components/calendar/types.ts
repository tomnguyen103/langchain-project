import type { Platform } from "@/db/schema";

export type CalendarTarget = {
  platform: Platform;
  status: string;
  externalUrl: string | null;
};

export type CalendarPost = {
  id: string;
  scheduledAt: string | null; // ISO string
  status: string;
  title: string;
  targets: CalendarTarget[];
};
