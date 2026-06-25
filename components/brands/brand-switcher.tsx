"use client";

import { useTransition } from "react";

import type { Brand } from "@/db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchBrandAction } from "@/app/(dashboard)/brands/actions";

interface BrandSwitcherProps {
  brands: Array<Pick<Brand, "id" | "name">>;
  currentBrandId: string | null;
}

/**
 * Topbar dropdown for switching between brand workspaces (Atrium).
 * Hidden when the user has no brands; "Personal" is always an option.
 */
export function BrandSwitcher({ brands, currentBrandId }: BrandSwitcherProps) {
  const [, startTransition] = useTransition();

  if (brands.length === 0) return null;

  function handleChange(value: string) {
    startTransition(async () => {
      await switchBrandAction(value === "__personal__" ? null : value);
    });
  }

  return (
    <Select
      value={currentBrandId ?? "__personal__"}
      onValueChange={handleChange}
    >
      <SelectTrigger className="h-8 w-36 text-xs" aria-label="Switch brand">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__personal__">Personal</SelectItem>
        {brands.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
