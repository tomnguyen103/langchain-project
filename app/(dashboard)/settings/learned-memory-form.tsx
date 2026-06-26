"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  clearLearnedMemoryAction,
  saveLearnedMemoryAction,
} from "./actions";

export function LearnedMemoryForm({
  initialTopics,
}: {
  initialTopics: string[];
}) {
  const [topics, setTopics] = useState(() =>
    initialTopics.length > 0 ? initialTopics : [""],
  );
  const [pending, startTransition] = useTransition();

  function updateTopic(index: number, value: string) {
    setTopics((current) =>
      current.map((topic, i) => (i === index ? value : topic)),
    );
  }

  function removeTopic(index: number) {
    setTopics((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  }

  function addTopic() {
    setTopics((current) => [...current, ""]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await saveLearnedMemoryAction({ topics: topics.join("\n") });
        toast.success("Learned memory saved.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save memory.",
        );
      }
    });
  }

  function clearMemory() {
    startTransition(async () => {
      try {
        await clearLearnedMemoryAction();
        setTopics([""]);
        toast.success("Learned memory cleared.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not clear memory.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Learned topics</Label>
        <div className="space-y-2">
          {topics.map((topic, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border p-2"
            >
              <Input
                value={topic}
                onChange={(event) => updateTopic(index, event.target.value)}
                aria-label={`Learned topic ${index + 1}`}
                placeholder="Topic or theme"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTopic(index)}
                aria-label={`Remove learned topic ${index + 1}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={addTopic}
          disabled={pending}
        >
          <Plus className="size-4" />
          Add topic
        </Button>
        <Button type="submit" disabled={pending}>
          <Save className="size-4" />
          Save memory
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={clearMemory}
          disabled={pending}
        >
          <Trash2 className="size-4" />
          Clear
        </Button>
      </div>
    </form>
  );
}
