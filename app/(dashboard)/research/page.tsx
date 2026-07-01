import { Lightbulb } from "lucide-react";

import { requireUserId } from "@/lib/clerk";
import type { Platform } from "@/db/schema";
import { langsmithRunUrl } from "@/lib/observability/langsmith";
import { PLATFORM_META } from "@/lib/platforms/constants";
import { listIdeas } from "@/lib/repos/generated-content";
import { listSocialAccounts } from "@/lib/repos/accounts";
import { listResearchTopics } from "@/lib/repos/research";
import { listResearchWatches } from "@/lib/repos/research-watches";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { IdeaCard } from "@/components/research/idea-card";
import { ResearchForm } from "@/components/research/research-form";
import { TopicList, type TopicView } from "@/components/research/topic-list";
import {
  ResearchWatchPanel,
  type ResearchWatchView,
} from "@/components/research/watch-panel";

export default async function ResearchPage() {
  const userId = await requireUserId();
  const [topics, ideas, accounts, watches] = await Promise.all([
    listResearchTopics(userId),
    listIdeas(userId),
    listSocialAccounts(userId),
    listResearchWatches(userId),
  ]);

  const ideaCountByTopic = new Map<string, number>();
  for (const idea of ideas) {
    if (idea.researchTopicId) {
      ideaCountByTopic.set(
        idea.researchTopicId,
        (ideaCountByTopic.get(idea.researchTopicId) ?? 0) + 1,
      );
    }
  }

  const topicViews: TopicView[] = topics.map((t) => ({
    id: t.id,
    niche: t.niche,
    status: t.status,
    ideaCount: ideaCountByTopic.get(t.id) ?? 0,
  }));
  const availablePlatforms = Array.from(
    new Set(
      accounts
        .filter((account) => account.status === "active")
        .map((account) => account.platform),
    ),
  );
  const platformOptions =
    availablePlatforms.length > 0
      ? availablePlatforms
      : (Object.keys(PLATFORM_META) as Platform[]);
  const watchViews: ResearchWatchView[] = watches.map((watch) => ({
    id: watch.id,
    niche: watch.niche,
    platforms: watch.platforms,
    frequency: watch.frequency,
    status: watch.status,
    lastRunAt: watch.lastRunAt?.toISOString() ?? null,
    nextRunAt: watch.nextRunAt?.toISOString() ?? null,
    lastSourceStatus: watch.lastSourceStatus ?? null,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Channels"
        title="Research & ideas"
        description="Drop a niche and let the agent research and generate content ideas."
      />

      <Tabs defaultValue="topics" className="mt-6">
        <TabsList>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="watches">Watches</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <ResearchForm />
          <TopicList topics={topicViews} />
        </TabsContent>

        <TabsContent value="ideas">
          {ideas.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No ideas yet"
              description="Research a niche on the Topics tab to generate some."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={{
                    id: idea.id,
                    content: idea.content,
                    traceUrl: langsmithRunUrl(idea.langsmithRunId),
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="watches">
          <ResearchWatchPanel
            watches={watchViews}
            availablePlatforms={platformOptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
