"use client";

import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Brand } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createBrandAction, deleteBrandAction, updateBrandAction } from "./brand-actions";

export function CreateBrandForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const result = await createBrandAction({ name: name.trim(), description: description.trim() || undefined });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Brand created.");
        setName("");
        setDescription("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create brand.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="brand-name">Name</Label>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="brand-desc">Description (optional)</Label>
        <Textarea
          id="brand-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this brand is about…"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Creating…" : "Create brand"}
      </Button>
    </form>
  );
}

export function DeleteBrandButton({ brand }: { brand: Brand }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`Delete brand "${brand.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteBrandAction(brand.id);
        toast.success("Brand deleted.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete brand.");
      }
    });
  }

  return (
    <Button variant="destructive" size="sm" onClick={onClick} disabled={pending}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

export function EditBrandForm({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateBrandAction(brand.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success("Brand updated.");
        onDone();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update brand.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`edit-name-${brand.id}`}>Name</Label>
        <Input
          id={`edit-name-${brand.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`edit-desc-${brand.id}`}>Description</Label>
        <Textarea
          id={`edit-desc-${brand.id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
