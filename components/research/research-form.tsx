"use client";

import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { startResearch } from "@/app/(dashboard)/research/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResearchForm() {
  const [niche, setNiche] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!niche.trim()) {
      toast.error("Enter a niche or topic.");
      return;
    }
    startTransition(async () => {
      try {
        await startResearch(niche);
        setNiche("");
        toast.success("Research started. Ideas will appear shortly.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to start research.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-xl border p-4"
    >
      <div className="flex-1 space-y-1.5">
        <label htmlFor="niche" className="text-sm font-medium">
          Research a niche
        </label>
        <Input
          id="niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. 'AI tools for indie founders'"
          disabled={pending}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        Research
      </Button>
    </form>
  );
}
