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

type TopicRow = { id: string; value: string };

function newTopicRow(value = ""): TopicRow {
  return { id: crypto.randomUUID(), value };
}

export function LearnedMemoryForm({
  initialTopics,
}: {
  initialTopics: string[];
}) {
  const [topics, setTopics] = useState<TopicRow[]>(() =>
    initialTopics.length > 0 ? initialTopics.map(newTopicRow) : [newTopicRow()],
  );
  const [pending, startTransition] = useTransition();

  function updateTopic(id: string, value: string) {
    setTopics((current) =>
      current.map((row) => (row.id === id ? { ...row, value } : row)),
    );
  }

  function removeTopic(id: string) {
    setTopics((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length > 0 ? next : [newTopicRow()];
    });
  }

  function addTopic() {
    setTopics((current) => [...current, newTopicRow()]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await saveLearnedMemoryAction({
          topics: topics.map((row) => row.value).join("\n"),
        });
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
        setTopics([newTopicRow()]);
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
          {topics.map((row, index) => (
            <div
              key={row.id}
              className="flex items-center gap-2 rounded-lg border p-2"
            >
              <Input
                value={row.value}
                onChange={(event) => updateTopic(row.id, event.target.value)}
                aria-label={`Learned topic ${index + 1}`}
                placeholder="Topic or theme"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTopic(row.id)}
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
