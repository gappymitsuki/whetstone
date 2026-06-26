import type {
  Case,
  Judgment,
  Rule,
  BatchResult,
  JudgeResponse,
  GeneralizeResponse,
  FinalLabel,
} from "@/lib/types";
import { GREY_TYPE_INFO } from "@/data/cases";
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
  // 明確なケース：ガイドラインから自明。常に高確信。
  if (!c.greyType) {
    return {
      label: c.trueLabel,
      confidence: 92,
      rationale:
        c.trueLabel === "違反"
          ? "断定・誇大表現を含み、ガイドラインから明らかに違反。"
          : "ガイドライン上の懸念は無く、明らかに適合。",
      reliedOnRuleIds: [],
    };
  }

  // グレーケース：該当する専門家ルールがあるか
  const rule = findCoveringRule(c, rules);
  const info = GREY_TYPE_INFO[c.greyType];

  if (rule && info) {
    // 学習済み → 明示の指針が与えられ、確信度が閾値を超える（=自走）
    return {
      label: info.label,
      confidence: HIGH_CONFIDENCE,
      rationale: `蓄積ルールに合致：${info.reason}`,
      reliedOnRuleIds: [rule.id],
    };
  }

  // 未学習 → 解釈が割れ、本当に迷う
  return {
    label: "要確認",
    confidence: LOW_CONFIDENCE,
    rationale:
      "ガイドラインの解釈が割れる類型で、該当する判断ルールが無いため確信が持てない。",
    reliedOnRuleIds: [],
  };
}

/* =========================================================================
 * ゲーティング
 * ========================================================================= */

/** confidence < threshold もしくは「要確認」ならエスカレ */
export function shouldEscalate(resp: JudgeResponse, threshold: number): boolean {
  return resp.label === "要確認" || resp.confidence < threshold;
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
      // 最終防衛線：判定保留（アプリは絶対に落とさない）
      return buildJudgment(
        c,
        {
          label: "要確認",
          confidence: 0,
          rationale: "判定に失敗したため保留中。",
          reliedOnRuleIds: [],
        },
        threshold,
        true
      );
    }
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
        ? `「${sourceCase.greyType}」類型：${info.reason}に該当するもの`
        : `「${sourceCase.copy}」と同種の表現`,
      label: expertLabel,
      reason: expertReason || info?.reason || "専門家判断に基づく",
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
