export type Label = "適合" | "違反" | "要確認";
export type FinalLabel = "適合" | "違反";

export interface Case {
  id: string;
  copy: string; // 広告コピー本文
  trueLabel: FinalLabel; // デモ内部の正解（正答率算出用。UIには通常出さない）
  greyType?: string; // グレー類型。バッチ間で再登場させ「学習が効いた」を見せる鍵
}

export interface Judgment {
  caseId: string;
  label: Label;
  confidence: number; // 0-100（LLM自己申告）
  rationale: string;
  reliedOnRuleIds: string[]; // どの蓄積ルールに依拠したか（因果ハイライト用）
  escalated: boolean;
  pending?: boolean; // API失敗時の「判定保留」
  routedExpertId?: string; // エスカレ時：どの専門家レーンへ振り分けたか
  routeReason?: string; // ルーター判定の根拠（最小文脈で表示）
}

export interface Rule {
  id: string;
  pattern: string; // 汎用化されたトリガー条件（特定コピーに依存しない）
  label: FinalLabel;
  reason: string;
  sourceCaseId: string; // 由来：どの専門家ジャッジから生まれたか
  greyType?: string; // 由来ケースの類型（オフライン照合・因果追跡用）
  createdAt: number;
}

export interface BatchResult {
  batchNumber: number;
  judgments: Judgment[];
  escalationRate: number; // escalated件数 / 総数
  accuracy: number; // 非エスカレ（自走判定）のうち trueLabel と一致した割合
}

/** /api/judge のレスポンス契約 */
export interface JudgeResponse {
  label: Label;
  confidence: number;
  rationale: string;
  reliedOnRuleIds: string[];
}

/** /api/generalize-rule のレスポンス契約 */
export interface GeneralizeResponse {
  pattern: string;
  label: FinalLabel;
  reason: string;
}
