import type {
  Case,
  Judgment,
  Rule,
  BatchResult,
  JudgeResponse,
  GeneralizeResponse,
  FinalLabel,
} from "@/lib/types";
import { GREY_TYPE_INFO, inferCaseFromCopy } from "@/data/cases";
import { routeEscalation } from "@/data/experts";
import { HIGH_CONFIDENCE, LOW_CONFIDENCE, OFFLINE_DEMO_MODE } from "@/lib/config";

/* =========================================================================
 * オフライン判定（事故耐性の心臓）
 * ルールの有無に応じて、ネット不通でも決定的に同じ挙動を再現する。
 * ドメイン知識は data/ 側（GREY_TYPE_INFO）に置き、ここではロジックのみ。
 * ========================================================================= */

/** あるケースを「カバーする」専門家由来ルールを探す（類型一致で照合） */
export function findCoveringRule(c: Case, rules: Rule[]): Rule | undefined {
  if (!c.greyType) return undefined;
  return rules.find((r) => r.greyType === c.greyType);
}

/**
 * オフライン判定。LLM を呼ばずに JudgeResponse を決定的に算出する。
 * - 明確なケース（greyType 無し）: 常に高確信で trueLabel を返す。
 * - グレーケース: 該当ルールがあれば高確信で自走、無ければ「要確認」で迷う。
 */
export function computeOfflineJudgment(c: Case, rules: Rule[]): JudgeResponse {
  // Clear case: obvious from the guideline. Always high confidence.
  if (!c.greyType) {
    return {
      label: c.trueLabel,
      confidence: 92,
      rationale:
        c.trueLabel === "Violation"
          ? "Contains an absolute/exaggerated claim — a clear violation per the guideline."
          : "No guideline concerns — clearly compliant.",
      reliedOnRuleIds: [],
    };
  }

  // Grey case: is there a covering expert rule?
  const rule = findCoveringRule(c, rules);
  const info = GREY_TYPE_INFO[c.greyType];

  if (rule && info) {
    // Learned → explicit guidance exists, confidence clears the threshold (self-driving)
    return {
      label: info.label,
      confidence: HIGH_CONFIDENCE,
      rationale: `Matches an accumulated rule: ${info.reason}`,
      reliedOnRuleIds: [rule.id],
    };
  }

  // Not yet learned → genuinely ambiguous
  return {
    label: "Needs Review",
    confidence: LOW_CONFIDENCE,
    rationale:
      "Ambiguous guideline interpretation and no matching rule yet, so not confident.",
    reliedOnRuleIds: [],
  };
}

/* =========================================================================
 * ゲーティング
 * ========================================================================= */

/** Escalate when confidence < threshold or label is "Needs Review". */
export function shouldEscalate(resp: JudgeResponse, threshold: number): boolean {
  return resp.label === "Needs Review" || resp.confidence < threshold;
}

/** JudgeResponse → Judgment（ゲーティング適用） */
export function toJudgment(
  caseId: string,
  resp: JudgeResponse,
  threshold: number,
  pending = false
): Judgment {
  return {
    caseId,
    label: resp.label,
    confidence: resp.confidence,
    rationale: resp.rationale,
    reliedOnRuleIds: resp.reliedOnRuleIds ?? [],
    escalated: pending ? false : shouldEscalate(resp, threshold),
    pending,
  };
}

/**
 * Case + JudgeResponse → Judgment。
 * エスカレする場合は、スマートエスカレーションとして最適な専門家レーンへ振り分ける。
 */
export function buildJudgment(
  c: Case,
  resp: JudgeResponse,
  threshold: number,
  pending = false
): Judgment {
  const j = toJudgment(c.id, resp, threshold, pending);
  if (j.escalated) {
    const route = routeEscalation(c);
    j.routedExpertId = route.expertId;
    j.routeReason = route.reason;
  }
  return j;
}

/* =========================================================================
 * ルール生成（専門家ジャッジ → 汎用ルール）
 * ========================================================================= */

let ruleSeq = 0;

/** 汎用化結果 + 由来ケースから Rule を組み立てる */
export function makeRule(
  sourceCase: Case,
  gen: GeneralizeResponse,
  now: number
): Rule {
  ruleSeq += 1;
  return {
    id: `rule_${now.toString(36)}_${ruleSeq}`,
    pattern: gen.pattern,
    label: gen.label,
    reason: gen.reason,
    sourceCaseId: sourceCase.id,
    greyType: sourceCase.greyType, // オフライン照合・因果追跡用
    createdAt: now,
  };
}

/* =========================================================================
 * バッチ集計
 * ========================================================================= */

export function computeBatchResult(
  batchNumber: number,
  judgments: Judgment[],
  cases: Case[]
): BatchResult {
  const total = judgments.length || 1;
  const escalatedCount = judgments.filter((j) => j.escalated).length;

  // 自走（非エスカレ・非保留）のうち trueLabel と一致した割合
  const selfDriven = judgments.filter((j) => !j.escalated && !j.pending);
  let correct = 0;
  for (const j of selfDriven) {
    const c = cases.find((x) => x.id === j.caseId);
    if (c && j.label === c.trueLabel) correct += 1;
  }
  const accuracy =
    selfDriven.length > 0 ? correct / selfDriven.length : 1; // 自走0件なら誤りも0 → 1.0

  return {
    batchNumber,
    judgments,
    escalationRate: escalatedCount / total,
    accuracy,
  };
}

/* =========================================================================
 * クライアント側オーケストレーション（API 経由 / オフライン切替・事故耐性）
 * ========================================================================= */

/**
 * 1ケースを判定する。
 * - OFFLINE_DEMO_MODE: API を一切呼ばずローカルで決定的に判定。
 * - 通常: /api/judge を呼ぶ。失敗時はローカルのオフライン判定にフォールバック。
 *   それでも算出不能な異常時のみ「判定保留(pending)」とし、アプリは落とさない。
 */
export async function judgeCase(
  c: Case,
  rules: Rule[],
  threshold: number
): Promise<Judgment> {
  if (OFFLINE_DEMO_MODE) {
    return buildJudgment(c, computeOfflineJudgment(c, rules), threshold);
  }

  try {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy: c.copy, rules }),
    });
    if (!res.ok) throw new Error(`judge http ${res.status}`);
    const data = (await res.json()) as JudgeResponse;
    return buildJudgment(c, data, threshold);
  } catch {
    // ネット不通でもデモを止めない：ローカルのオフライン判定へ
    try {
      return buildJudgment(c, computeOfflineJudgment(c, rules), threshold);
    } catch {
      // Last line of defense: pending (never let the app crash)
      return buildJudgment(
        c,
        {
          label: "Needs Review",
          confidence: 0,
          rationale: "Judging failed; held for review.",
          reliedOnRuleIds: [],
        },
        threshold,
        true
      );
    }
  }
}

/**
 * Judge an ad-hoc, live-typed copy. Returns both the synthetic Case (so the UI
 * can register it for the queue / list lookups) and its Judgment.
 * - OFFLINE_DEMO_MODE: classify the copy heuristically, then judge deterministically.
 * - Online: send the copy to /api/judge; route via the inferred synthetic case.
 */
export async function judgeAdhoc(
  copy: string,
  rules: Rule[],
  threshold: number,
  now: number
): Promise<{ caseObj: Case; judgment: Judgment }> {
  const caseObj = inferCaseFromCopy(copy, `adhoc_${now.toString(36)}`);

  if (OFFLINE_DEMO_MODE) {
    return {
      caseObj,
      judgment: buildJudgment(caseObj, computeOfflineJudgment(caseObj, rules), threshold),
    };
  }

  try {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy, rules }),
    });
    if (!res.ok) throw new Error(`judge http ${res.status}`);
    const data = (await res.json()) as JudgeResponse;
    return { caseObj, judgment: buildJudgment(caseObj, data, threshold) };
  } catch {
    return {
      caseObj,
      judgment: buildJudgment(caseObj, computeOfflineJudgment(caseObj, rules), threshold),
    };
  }
}

/** バッチ全体を判定（順次。デモ用に件数は少ないので十分） */
export async function judgeBatch(
  cases: Case[],
  rules: Rule[],
  threshold: number
): Promise<Judgment[]> {
  const out: Judgment[] = [];
  for (const c of cases) {
    out.push(await judgeCase(c, rules, threshold));
  }
  return out;
}

/**
 * 専門家判断を汎用ルールに変換する。
 * - OFFLINE_DEMO_MODE もしくは API 失敗時は、由来ケースの類型情報からローカル生成。
 */
export async function generalizeRule(
  sourceCase: Case,
  expertLabel: FinalLabel,
  expertReason: string,
  now: number
): Promise<Rule> {
  const localGen = (): GeneralizeResponse => {
    const info = sourceCase.greyType
      ? GREY_TYPE_INFO[sourceCase.greyType]
      : undefined;
    return {
      pattern: info
        ? `Copy of the "${sourceCase.greyType}" type: anything matching — ${info.reason}`
        : `Copy of the same kind as "${sourceCase.copy}"`,
      label: expertLabel,
      reason: expertReason || info?.reason || "Based on the expert's judgment",
    };
  };

  if (OFFLINE_DEMO_MODE) {
    return makeRule(sourceCase, localGen(), now);
  }

  try {
    const res = await fetch("/api/generalize-rule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        copy: sourceCase.copy,
        expertLabel,
        expertReason,
      }),
    });
    if (!res.ok) throw new Error(`generalize http ${res.status}`);
    const gen = (await res.json()) as GeneralizeResponse;
    return makeRule(sourceCase, gen, now);
  } catch {
    return makeRule(sourceCase, localGen(), now);
  }
}
