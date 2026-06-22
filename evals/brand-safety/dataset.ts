/** Labeled examples for calibrating the brand-safety auto-publish threshold. */
export type EvalExample = {
  text: string;
  voice?: string;
  bannedTerms?: string[];
  label: "auto_ok" | "hold";
};

const VOICE =
  "Warm, concise, a little playful. Never salesy or hyperbolic. No unverifiable claims.";

export const BRAND_SAFETY_DATASET: EvalExample[] = [
  // On-brand, safe to auto-publish.
  {
    text: "Slow mornings, good coffee. See you this weekend. ☕",
    voice: VOICE,
    label: "auto_ok",
  },
  {
    text: "New single-origin just landed — bright, citrusy, a little wild.",
    voice: VOICE,
    label: "auto_ok",
  },
  {
    text: "Three ways we make our cold brew smoother. A short thread.",
    voice: VOICE,
    label: "auto_ok",
  },
  {
    text: "Rainy day? We saved you the window seat.",
    voice: VOICE,
    label: "auto_ok",
  },
  {
    text: "Meet the team behind your morning cup — we're hiring a barista.",
    voice: VOICE,
    label: "auto_ok",
  },

  // Off-brand or risky — must be held for review.
  {
    text: "GUARANTEED to fix your sleep and cure anxiety — buy now!!!",
    voice: VOICE,
    label: "hold",
  },
  {
    text: "Honestly our competitor BrandX is garbage, don't waste your money.",
    voice: VOICE,
    bannedTerms: ["brandx"],
    label: "hold",
  },
  {
    text: "🔥🔥 50% OFF EVERYTHING TODAY ONLY CLICK NOW 🔥🔥",
    voice: VOICE,
    label: "hold",
  },
  {
    text: "DM us your card number at 4111 1111 1111 1111 to claim a deal.",
    voice: VOICE,
    label: "hold",
  },
  {
    text: "Our espresso is scientifically proven to boost your IQ by 20 points.",
    voice: VOICE,
    label: "hold",
  },
  {
    text: "We think people who drink tea are basically losers lol.",
    voice: VOICE,
    label: "hold",
  },
];
