export const PROMPT_VERSION = "v1";

export const digestPrompt = (
  topic: string,
  opts: { voice?: string; learnedNotes?: string } = {},
) =>
  `You are a social media strategist. Analyze this topic and produce a concise brief (3-5 sentences) covering the core angle, key talking points, target audience, and tone.${
    opts.voice ? `\n\nBrand voice to honor: ${opts.voice}` : ""
  }${
    opts.learnedNotes
      ? `\n\nThemes that have performed well recently — lean into them where relevant: ${opts.learnedNotes}`
      : ""
  }

Topic: ${topic}`;

export const draftPrompt = (args: {
  platform: string;
  maxLength: number;
  digest: string;
  topic: string;
  voice?: string;
  bannedTerms?: string[];
}) =>
  `Write a single ${args.platform} caption for this topic. Keep it under ${args.maxLength} characters, match ${args.platform} conventions (tone, and hashtags where appropriate), and make it engaging.${
    args.voice ? ` Brand voice: ${args.voice}.` : ""
  }${
    args.bannedTerms && args.bannedTerms.length > 0
      ? ` Never use these words or phrases: ${args.bannedTerms.join(", ")}.`
      : ""
  } Output ONLY the caption text, with no preamble or quotes.

Topic: ${args.topic}

Brief: ${args.digest}`;

export const critiquePrompt = (drafts: string) =>
  `Review these social media captions for quality, clarity, and platform fit. If they are all strong and ready to publish, respond with exactly "OK". Otherwise respond with "REVISE:" followed by one short line of specific, actionable feedback.

${drafts}`;

export const ideationPrompt = (niche: string, context: string) =>
  `You are a content strategist. Based on the niche and any sources below, generate 6 distinct, specific content ideas — each a single engaging angle or hook on its own line, with no numbering or bullets. Output ONLY the ideas.

Niche: ${niche}

Sources:
${context}`;

export const refinePrompt = (args: {
  platform: string;
  maxLength: number;
  draft: string;
  notes: string;
}) =>
  `Improve this ${args.platform} caption based on the feedback. Keep it under ${args.maxLength} characters. Output ONLY the improved caption, with no preamble or quotes.

Feedback: ${args.notes}

Caption: ${args.draft}`;

export const brandSafetyJudgePrompt = (args: { text: string; voice?: string }) =>
  `You are a brand-safety and brand-voice reviewer for social media posts. Rate how safe and on-brand this caption is to publish.
${args.voice ? `\nBrand voice and guidelines:\n${args.voice}\n` : ""}
Consider brand-voice fit, tone, policy and factual risk, offensive or controversial content, and platform appropriateness.

Respond with ONLY a single number from 0.0 to 1.0 (1.0 = perfectly safe and on-brand; 0.0 = must not publish), optionally followed by " - <one short reason>".

Caption:
${args.text}`;
