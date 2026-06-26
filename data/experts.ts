import type { Case } from "@/lib/types";

/**
 * Expert lanes (the destinations of smart escalation).
 *
 * The "routing structure" that decides which judgment goes to which expert.
 * Expert definitions and routing rules live here, never in the logic
 * (swap the domain by editing this file + guideline.ts + cases.ts).
 *
 * Note: badge / dot class strings are written as static literals so Tailwind
 * can scan them (tailwind.config content includes ./data).
 */
export interface Expert {
  id: string;
  name: string; // full name (lane header)
  short: string; // short label for badges
  scope: string; // the topics this lane owns
  badge: string; // Tailwind classes for the badge
  dot: string; // Tailwind classes for the dot
}

export const EXPERTS: Expert[] = [
  {
    id: "legal",
    name: "Legal & Compliance",
    short: "Legal",
    scope:
      "Truth-in-advertising: evidence for superlatives, comparative claims, price disclosure",
    badge: "text-violet-300 bg-violet-500/15 border-violet-500/40",
    dot: "bg-violet-400",
  },
  {
    id: "brand",
    name: "Brand & Copy Review",
    short: "Brand",
    scope: "Tone & manner, expression quality, consistency of self-referential claims",
    badge: "text-amber-300 bg-amber-500/15 border-amber-500/40",
    dot: "bg-amber-400",
  },
];

export function getExpert(id: string | undefined): Expert | undefined {
  return EXPERTS.find((e) => e.id === id);
}

/** Grey type → owning expert (primary routing). */
const GREY_TYPE_TO_EXPERT: Record<string, { expertId: string; reason: string }> =
  {
    superlative_no_basis: {
      expertId: "legal",
      reason: "Evidence for a superlative claim (truth-in-advertising)",
    },
    comparison_no_source: {
      expertId: "legal",
      reason: "Source / conditions for a comparative claim",
    },
    price_vague: {
      expertId: "legal",
      reason: "Price / discount disclosure compliance",
    },
    subjective_hype: {
      expertId: "brand",
      reason: "Tone & manner and use of superlative wording",
    },
    internal_superlative: {
      expertId: "brand",
      reason: "Validity of a self-referential claim / brand consistency",
    },
  };

/** Content-based routing from the copy text (fallback when no grey type). */
const KEYWORD_ROUTES: { expertId: string; reason: string; re: RegExp }[] = [
  {
    expertId: "legal",
    reason: "Price / discount disclosure compliance",
    re: /(half price|free|discount|% off|today only|weekend|special price|sale|price)/i,
  },
  {
    expertId: "legal",
    reason: "Superlative / comparison / evidence (truth-in-advertising)",
    re: /(no\.?\s?1|#\s?1|world'?s best|industry|best|than (other|our)|\d+\s?x|\d+ times|vs\.?)/i,
  },
];

/**
 * Route an escalation to the best expert lane.
 * 1) grey-type primary map → 2) content keywords → 3) default (brand).
 */
export function routeEscalation(c: Case): { expertId: string; reason: string } {
  if (c.greyType && GREY_TYPE_TO_EXPERT[c.greyType]) {
    return GREY_TYPE_TO_EXPERT[c.greyType];
  }
  for (const r of KEYWORD_ROUTES) {
    if (r.re.test(c.copy)) return { expertId: r.expertId, reason: r.reason };
  }
  return { expertId: "brand", reason: "General brand-expression review" };
}

/** Resolve which expert lane sharpened a rule (from its source grey type). */
export function expertForGreyType(greyType: string | undefined): Expert | undefined {
  if (!greyType) return undefined;
  const r = GREY_TYPE_TO_EXPERT[greyType];
  return r ? getExpert(r.expertId) : undefined;
}
