export type ReplyCopilotIntent =
  | "abuse"
  | "complaint"
  | "lead"
  | "question"
  | "praise"
  | "spam"
  | "other"
  | null;

export type ReplyCopilotSuggestion = {
  text: string;
  canSend: boolean;
  reason?: string;
};

const BLOCKED_INTENTS = new Set<ReplyCopilotIntent>(["abuse", "complaint"]);

export function canSendReplySuggestion(intent: ReplyCopilotIntent): boolean {
  return !BLOCKED_INTENTS.has(intent);
}

export function buildReplySuggestion(input: {
  author: string;
  text: string;
  intent: ReplyCopilotIntent;
}): ReplyCopilotSuggestion {
  const name = cleanName(input.author);
  const prefix = name ? `Thanks ${name}.` : "Thanks for reaching out.";

  if (input.intent === "abuse") {
    return {
      canSend: false,
      reason: "Abuse is held for manual moderation.",
      text: "Do not auto-send. Review this comment in the source platform, then hide, report, or respond manually if needed.",
    };
  }

  if (input.intent === "complaint") {
    return {
      canSend: false,
      reason: "Complaints need a human review before any public response.",
      text: `${prefix} We want to look into this carefully. Please message us with the account or order details so our team can help.`,
    };
  }

  if (input.intent === "lead") {
    return {
      canSend: true,
      text: `${prefix} We can help with that. Send us a message with the details and our team will follow up.`,
    };
  }

  if (input.intent === "question") {
    return {
      canSend: true,
      text: `${prefix} Good question. Share a bit more context and we will point you in the right direction.`,
    };
  }

  if (input.intent === "praise") {
    return {
      canSend: true,
      text: `${prefix} We appreciate it.`,
    };
  }

  return {
    canSend: true,
    text: `${prefix} We appreciate you taking the time to comment.`,
  };
}

function cleanName(author: string): string {
  return author.trim().replace(/^@+/, "").slice(0, 40);
}
