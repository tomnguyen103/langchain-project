import { requireUserId } from "@/lib/clerk";
import { listIdeas } from "@/lib/repos/generated-content";
import { listResearchTopics } from "@/lib/repos/research";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdeaCard } from "@/components/research/idea-card";
import { ResearchForm } from "@/components/research/research-form";
import { TopicList, type TopicView } from "@/components/research/topic-list";

export default async function ResearchPage() {
  const userId = await requireUserId();
  const [topics, ideas] = await Promise.all([
    listResearchTopics(userId),
    listIdeas(userId),
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

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Research &amp; ideas</h1>
      <p className="text-muted-foreground mt-1">
        Drop a niche and let the agent research and generate content ideas.
      </p>

      <Tabs defaultValue="topics" className="mt-6">
        <TabsList>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="space-y-4">
          <ResearchForm />
          <TopicList topics={topicViews} />
        </TabsContent>

        <TabsContent value="ideas">
          {ideas.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No ideas yet. Research a niche on the Topics tab to generate some.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={{ id: idea.id, content: idea.content }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
