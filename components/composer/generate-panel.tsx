"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { Platform } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GeneratePanel({
  platforms,
  onGenerated,
}: {
  platforms: Platform[];
  onGenerated: (drafts: Record<string, string>) => void;
}) {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!topic.trim()) {
      toast.error("Enter a topic or niche first.");
      return;
    }
    if (platforms.length === 0) {
      toast.error("Select an account first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Generation failed");
      onGenerated(data.drafts as Record<string, string>);
      toast.success("Generated captions for each platform.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-accent/40 flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="text-primary size-3.5" /> Generate with AI
        </div>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="A niche or topic, e.g. 'sustainable home-office tips'"
          disabled={loading}
          aria-label="Topic for AI generation"
        />
      </div>
      <Button type="button" onClick={generate} disabled={loading}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        Generate
      </Button>
    </div>
  );
}
