export const PROMPT_VERSION = "v1";

export const digestPrompt = (topic: string) =>
  `You are a social media strategist. Analyze this topic and produce a concise brief (3-5 sentences) covering the core angle, key talking points, target audience, and tone.

Topic: ${topic}`;

export const draftPrompt = (args: {
  platform: string;
  maxLength: number;
  digest: string;
  topic: string;
}) =>
  `Write a single ${args.platform} caption for this topic. Keep it under ${args.maxLength} characters, match ${args.platform} conventions (tone, and hashtags where appropriate), and make it engaging. Output ONLY the caption text, with no preamble or quotes.

Topic: ${args.topic}

Brief: ${args.digest}`;

export const critiquePrompt = (drafts: string) =>
  `Review these social media captions for quality, clarity, and platform fit. If they are all strong and ready to publish, respond with exactly "OK". Otherwise respond with "REVISE:" followed by one short line of specific, actionable feedback.

${drafts}`;

export const refinePrompt = (args: {
  platform: string;
  maxLength: number;
  draft: string;
  notes: string;
}) =>
  `Improve this ${args.platform} caption based on the feedback. Keep it under ${args.maxLength} characters. Output ONLY the improved caption, with no preamble or quotes.

Feedback: ${args.notes}

Caption: ${args.draft}`;
