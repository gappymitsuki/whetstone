import type { Rule } from "@/lib/types";

/** Format accumulated rules for the LLM. */
function formatRules(rules: Rule[]): string {
  if (rules.length === 0) {
    return "(No expert-derived rules accumulated yet.)";
  }
  return rules
    .map(
      (r) =>
        `- [${r.id}] condition: ${r.pattern} / verdict: ${r.label} / reason: ${r.reason}`
    )
    .join("\n");
}

/** Prompt for judging (/api/judge). */
export function buildJudgePrompt(
  guideline: string,
  rules: Rule[],
  copy: string
): { system: string; user: string } {
  const system = `You are a reviewer of brand advertising copy. Judge whether each piece of copy is "Compliant" or "Violation" against the provided [Guideline].

You are also given a [Rule Book] accumulated from past judgments by human experts. These are real expert decisions, generalized; treat them as the official interpretive guidance for the guideline.

Judging policy:
- If a rule clearly applies, treat it as authoritative and judge with high confidence. List the id(s) of the rule(s) you relied on in reliedOnRuleIds.
- Even with no matching rule, if the guideline makes the verdict obvious, judge with high confidence.
- When "a rule clearly applies" or "the guideline is obvious" → confidence is 85 or higher.
- When there is no matching rule AND the guideline is genuinely ambiguous → label is "Needs Review" and confidence is below 70.
- Do not assert Compliant/Violation on a guess. If unsure, honestly choose "Needs Review".

Output STRICT JSON only. No preamble, no explanation, no code fences.
Output schema:
{ "label": "Compliant" | "Violation" | "Needs Review", "confidence": integer 0-100, "rationale": "concise reason (<= 140 chars)", "reliedOnRuleIds": ["ruleId", ...] }`;

  const user = `[Guideline]
${guideline}

[Rule Book (expert-derived)]
${formatRules(rules)}

[Copy under review]
${copy}

Judge this copy and output JSON only.`;

  return { system, user };
}

/** Prompt for rule generalization (/api/generalize-rule). */
export function buildGeneralizePrompt(
  guideline: string,
  copy: string,
  expertLabel: string,
  expertReason: string
): { system: string; user: string } {
  const system = `You are a review-rule designer. Generalize an expert's judgment on a specific piece of copy into a reusable trigger condition that does NOT depend on that exact copy.

Requirements:
- "pattern" must apply not just to this copy but to other copy of the same type. Do not copy proper nouns or specific phrases verbatim.
- "label" adopts the expert's verdict (Compliant/Violation) as-is.
- "reason" states concisely which aspect of the guideline it rests on.

Good example:
  Input copy "The #1 writing feel in the industry" + expert "Violation: no objective supporting data"
  → pattern "Superlative/ranking claims such as 'No.1', '#1', 'world's best', 'best' with no objective supporting data (research body, scope, date) attached", label "Violation", reason "Guideline 1: superlatives require evidence"

Output STRICT JSON only. No preamble, no explanation, no code fences.
Output schema:
{ "pattern": "a general trigger condition not tied to specific copy", "label": "Compliant" | "Violation", "reason": "reason (<= 140 chars)" }`;

  const user = `[Guideline]
${guideline}

[Copy the expert judged]
${copy}

[Expert's judgment]
verdict: ${expertLabel}
reason: ${expertReason}

Generalize this into a reusable rule and output JSON only.`;

  return { system, user };
}
