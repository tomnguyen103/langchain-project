import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

export function PagePlaceholder({
  title,
  description,
  note,
}: {
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Coming soon"
        description={note ?? "This area is being built."}
      />
    </div>
  );
}
