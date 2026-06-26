import type { Case } from "@/lib/types";

/**
 * エキスパート・レーン（スマートエスカレーションのルーティング先）。
 *
 * 「どの判断を、どの専門家へ委ねるべきか」を規定するルーティング構造。
 * 専門家の定義・振り分けルールはこのファイルに集約し、ロジックには置かない
 * （ドメイン差し替え時はここと guideline.ts / cases.ts の編集だけで済む）。
 *
 * 注：badge / dot のクラス文字列は Tailwind にスキャンさせるため、
 *     ここに静的な文字列としてベタ書きしている（tailwind.config の content に data/ を含める）。
 */
export interface Expert {
  id: string;
  name: string; // 正式名（レーン見出し）
  short: string; // バッジ用の短縮名
  scope: string; // 担当する論点
  badge: string; // バッジの Tailwind クラス
  dot: string; // ドットの Tailwind クラス
}

export const EXPERTS: Expert[] = [
  {
    id: "legal",
    name: "法務・コンプライアンス",
    short: "法務",
    scope: "景品表示法（優良誤認・有利誤認）、比較広告、価格表示の適法性",
    badge: "text-violet-300 bg-violet-500/15 border-violet-500/40",
    dot: "bg-violet-400",
  },
  {
    id: "brand",
    name: "ブランド・コピー審査",
    short: "ブランド",
    scope: "トーン＆マナー、表現の品位、自社表現の一貫性",
    badge: "text-amber-300 bg-amber-500/15 border-amber-500/40",
    dot: "bg-amber-400",
  },
];

export function getExpert(id: string | undefined): Expert | undefined {
  return EXPERTS.find((e) => e.id === id);
}

/** グレー類型 → 担当エキスパート（一次ルーティング） */
const GREY_TYPE_TO_EXPERT: Record<string, { expertId: string; reason: string }> =
  {
    最上級_根拠なし: {
      expertId: "legal",
      reason: "最上級表現の根拠（景表法：優良誤認）の論点",
    },
    比較_出典なし: {
      expertId: "legal",
      reason: "比較広告の出典・条件（景表法）の論点",
    },
    価格_条件曖昧: {
      expertId: "legal",
      reason: "価格・割引表示の適法性（景表法：有利誤認）の論点",
    },
    主観的誇大: {
      expertId: "brand",
      reason: "情緒表現のトーン＆マナーと最上級語の扱い",
    },
    自社内最上級: {
      expertId: "brand",
      reason: "自社比較表現の妥当性・ブランド整合の論点",
    },
  };

/** コピー本文からの内容ベース・ルーティング（類型が無い場合のフォールバック） */
const KEYWORD_ROUTES: { expertId: string; reason: string; re: RegExp }[] = [
  {
    expertId: "legal",
    reason: "価格・割引の表示適法性",
    re: /(半額|割引|価格|円|無料|タダ|特別価格|OFF|%|％)/,
  },
  {
    expertId: "legal",
    reason: "最上級・比較・根拠の論点（景表法）",
    re: /(No\.?\s?1|世界一|日本一|史上最高|最高|最強|業界|他社|比|[0-9０-９]+倍)/,
  },
];

/**
 * エスカレーションを最適なエキスパート・レーンへ振り分ける。
 * 1) グレー類型の一次マップ → 2) 内容ベースのキーワード → 3) 既定（ブランド）。
 */
export function routeEscalation(c: Case): { expertId: string; reason: string } {
  if (c.greyType && GREY_TYPE_TO_EXPERT[c.greyType]) {
    return GREY_TYPE_TO_EXPERT[c.greyType];
  }
  for (const r of KEYWORD_ROUTES) {
    if (r.re.test(c.copy)) return { expertId: r.expertId, reason: r.reason };
  }
  return { expertId: "brand", reason: "一般のブランド表現審査" };
}

/** ルール（由来ケースの類型）から、研磨した専門家レーンを引く */
export function expertForGreyType(greyType: string | undefined): Expert | undefined {
  if (!greyType) return undefined;
  const r = GREY_TYPE_TO_EXPERT[greyType];
  return r ? getExpert(r.expertId) : undefined;
}
