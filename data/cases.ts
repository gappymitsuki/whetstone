import type { Case, FinalLabel } from "@/lib/types";

/**
 * Seed cases, grouped by batch. Swappable.
 *
 * Mix per batch (10 each): 3 clearly compliant / 2 clear violations / 5 grey.
 * Grey types recur across batches (with different copy) so the audience can see
 * that "learning kicked in".
 *
 * To swap the domain, edit only this file and data/guideline.ts.
 */

/**
 * Per-grey-type judgment rationale a human expert would give.
 * Used by the offline demo mode to produce the "still unsure" rationale, and
 * the high-confidence rationale once a matching rule exists (keeps domain
 * knowledge out of the logic).
 */
export const GREY_TYPE_INFO: Record<
  string,
  { reason: string; label: FinalLabel }
> = {
  superlative_no_basis: {
    reason:
      "Superlative claim (\"No.1\", \"#1\", \"best\") with no objective supporting data attached (Guideline 1)",
    label: "Violation",
  },
  comparison_no_source: {
    reason:
      "Competitor comparison with no source or comparison conditions stated (Guideline 2)",
    label: "Violation",
  },
  subjective_hype: {
    reason:
      "Emotional copy that still makes a \"best ever / in history\" superlative claim with no basis (Guideline 1)",
    label: "Violation",
  },
  internal_superlative: {
    reason:
      "Comparison is confined to the brand's own products (self-comparison), which is allowed (Note)",
    label: "Compliant",
  },
  price_vague: {
    reason:
      "Price/discount claim without tax-inclusive pricing or applicable conditions (Guideline 5)",
    label: "Violation",
  },
};

export const BATCHES: Case[][] = [
  // ===== Batch 1 =====
  [
    // Clearly compliant ×3
    { id: "b1-c1", copy: "Write smoothly, every day.", trueLabel: "Compliant" },
    { id: "b1-c2", copy: "New: 0.5mm fine-tip pen.", trueLabel: "Compliant" },
    { id: "b1-c3", copy: "Now available in a 10-color set.", trueLabel: "Compliant" },
    // Clear violations ×2
    {
      id: "b1-v1",
      copy: "A pen that never tires your hand.",
      trueLabel: "Violation",
    },
    { id: "b1-v2", copy: "Anyone will write beautifully.", trueLabel: "Violation" },
    // Grey ×5
    {
      id: "b1-g1",
      copy: "The #1 writing feel in the industry.",
      trueLabel: "Violation",
      greyType: "superlative_no_basis",
    },
    {
      id: "b1-g2",
      copy: "Twice as smooth as other brands.",
      trueLabel: "Violation",
      greyType: "comparison_no_source",
    },
    {
      id: "b1-g3",
      copy: "The smoothest feel in history, just for you.",
      trueLabel: "Violation",
      greyType: "subjective_hype",
    },
    {
      id: "b1-g4",
      copy: "Our best quality ever.",
      trueLabel: "Compliant",
      greyType: "internal_superlative",
    },
    {
      id: "b1-g5",
      copy: "Half price, now only.",
      trueLabel: "Violation",
      greyType: "price_vague",
    },
  ],

  // ===== Batch 2 (same grey types, new copy) =====
  [
    // Clearly compliant ×3
    { id: "b2-c1", copy: "It glides from the first stroke.", trueLabel: "Compliant" },
    { id: "b2-c2", copy: "New: 0.38mm ultra-fine.", trueLabel: "Compliant" },
    { id: "b2-c3", copy: "Added 5 new colors.", trueLabel: "Compliant" },
    // Clear violations ×2
    {
      id: "b2-v1",
      copy: "A notebook that guarantees better grades.",
      trueLabel: "Violation",
    },
    {
      id: "b2-v2",
      copy: "We promise it never bleeds — 100%.",
      trueLabel: "Violation",
    },
    // Grey ×5 (recurring)
    {
      id: "b2-g1",
      copy: "The #1 best-selling sketchbook.",
      trueLabel: "Violation",
      greyType: "superlative_no_basis",
    },
    {
      id: "b2-g2",
      copy: "Lasts 3x longer than other inks.",
      trueLabel: "Violation",
      greyType: "comparison_no_source",
    },
    {
      id: "b2-g3",
      copy: "The finest touch in history, right here.",
      trueLabel: "Violation",
      greyType: "subjective_hype",
    },
    {
      id: "b2-g4",
      copy: "Our best color yet, vs. our previous line.",
      trueLabel: "Compliant",
      greyType: "internal_superlative",
    },
    {
      id: "b2-g5",
      copy: "Weekend-only special price.",
      trueLabel: "Violation",
      greyType: "price_vague",
    },
  ],

  // ===== Batch 3 (recurring again, new copy) =====
  [
    // Clearly compliant ×3
    {
      id: "b3-c1",
      copy: "Just the right width for your planner.",
      trueLabel: "Compliant",
    },
    { id: "b3-c2", copy: "Refill leads back in stock.", trueLabel: "Compliant" },
    {
      id: "b3-c3",
      copy: "Limited edition, while supplies last.",
      trueLabel: "Compliant",
    },
    // Clear violations ×2
    {
      id: "b3-v1",
      copy: "Anyone is guaranteed to master calligraphy.",
      trueLabel: "Violation",
    },
    { id: "b3-v2", copy: "A lead that never breaks.", trueLabel: "Violation" },
    // Grey ×5 (recurring)
    {
      id: "b3-g1",
      copy: "The #1 fountain pen in customer satisfaction.",
      trueLabel: "Violation",
      greyType: "superlative_no_basis",
    },
    {
      id: "b3-g2",
      copy: "Uses half the ink compared to others.",
      trueLabel: "Violation",
      greyType: "comparison_no_source",
    },
    {
      id: "b3-g3",
      copy: "The most writable pen in history.",
      trueLabel: "Violation",
      greyType: "subjective_hype",
    },
    {
      id: "b3-g4",
      copy: "Our smoothest ever, vs. our past models.",
      trueLabel: "Compliant",
      greyType: "internal_superlative",
    },
    {
      id: "b3-g5",
      copy: "Today only, at a special price.",
      trueLabel: "Violation",
      greyType: "price_vague",
    },
  ],
];

export const TOTAL_BATCHES = BATCHES.length;

/** Look up the original case by copy text (server-side offline fallback). */
export function findCaseByCopy(copy: string): Case | undefined {
  for (const batch of BATCHES) {
    const hit = batch.find((c) => c.copy === copy);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Heuristic classifier for ad-hoc / live input (offline demo mode).
 * Infers a synthetic Case (greyType + intended label) from arbitrary copy by
 * keyword detection, so a typed copy behaves like a seeded one — including
 * self-driving once a matching rule exists. Order matters.
 */
export function inferCaseFromCopy(copy: string, id: string): Case {
  const t = copy.toLowerCase();
  const has = (re: RegExp) => re.test(t);

  // 1) Absolute / guarantee wording → clear violation (no grey type).
  if (has(/\b(never|always|guarantee[ds]?|anyone|everyone|100%|promise)\b/)) {
    return { id, copy, trueLabel: "Violation" };
  }
  // 2) Self-comparison ("our best ever", "vs our previous") → allowed.
  if (
    has(/\bour\b.*\b(best|finest|smoothest|greatest)\b/) ||
    has(/\bvs\.?\s*our\b/) ||
    has(/than our\b/)
  ) {
    return { id, copy, trueLabel: "Compliant", greyType: "internal_superlative" };
  }
  // 3) Price / discount wording.
  if (
    has(
      /\b(half price|free|discount|% off|today only|weekend|special price|sale|now only|limited time)\b/
    )
  ) {
    return { id, copy, trueLabel: "Violation", greyType: "price_vague" };
  }
  // 4) Comparison against others.
  if (has(/(than other|compared to|\bvs\.?\b|\b\d+\s?x\b|\d+ times)/)) {
    return { id, copy, trueLabel: "Violation", greyType: "comparison_no_source" };
  }
  // 5) "best ever / in history" emotional superlative.
  if (has(/(in history|best ever|finest.*ever|most .* in history)/)) {
    return { id, copy, trueLabel: "Violation", greyType: "subjective_hype" };
  }
  // 6) Superlative / ranking claims.
  if (has(/(no\.?\s?1|#\s?1|world'?s best|industry|best-selling|\bbest\b)/)) {
    return { id, copy, trueLabel: "Violation", greyType: "superlative_no_basis" };
  }
  // 7) Otherwise benign.
  return { id, copy, trueLabel: "Compliant" };
}
