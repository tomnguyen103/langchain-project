"use client";

import { useState } from "react";

import type { Brand } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DeleteBrandButton, EditBrandForm } from "./brand-controls";

export function BrandCard({ brand }: { brand: Brand }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{brand.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0 font-mono text-xs">
            {brand.slug}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <EditBrandForm brand={brand} onDone={() => setEditing(false)} />
        ) : (
          <>
            {brand.description && (
              <p className="text-muted-foreground text-sm">{brand.description}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <DeleteBrandButton brand={brand} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
