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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-1">{description}</p>
      <div className="text-muted-foreground mt-8 rounded-xl border border-dashed p-12 text-center text-sm">
        {note ?? "Coming soon."}
      </div>
    </div>
  );
}
