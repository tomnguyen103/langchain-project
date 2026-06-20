/** Variables available to a reply template. */
export type ReplyVars = {
  author: string;
  text: string;
};

/**
 * Render a reply template, substituting {{author}}, {{text}}, and {{handle}}
 * (an alias for the commenter's name — not @-prefixed). Unknown placeholders
 * are left as-is.
 */
export function renderTemplate(template: string, vars: ReplyVars): string {
  const map: Record<string, string> = {
    author: vars.author,
    handle: vars.author,
    text: vars.text,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) =>
    Object.hasOwn(map, key) ? map[key] : whole,
  );
}
