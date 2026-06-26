import type { Case } from "@/lib/types";

/**
 * シードケース（バッチ別）。差し替え可能。
 *
 * 配分（各バッチ10件）：明確に適合3 / 明確に違反2 / グレー5。
 * グレー類型(greyType)をバッチ間で再登場させることで「学習が効いた」を見せる。
 *
 * ドメインを差し替える場合、このファイルと data/guideline.ts だけ編集すればよい。
 */

/**
 * グレー類型ごとの「専門家が下すであろう判断理由」。
 * オフラインデモモードで、ルールが無いケースの想定理由や、
 * ルール獲得後の高確信判定の理由文に使う（ドメイン知識をロジックに置かないための分離）。
 */
export const GREY_TYPE_INFO: Record<
  string,
  { reason: string; label: "適合" | "違反" }
> = {
  最上級_根拠なし: {
    reason:
      "「No.1」等の最上級表現に客観的根拠データの添付が無いため（ガイドライン1）",
    label: "違反",
  },
  比較_出典なし: {
    reason: "競合比較に出典・比較条件の明示が無いため（ガイドライン2）",
    label: "違反",
  },
  主観的誇大: {
    reason:
      "情緒的文脈でも「史上最高」等の最上級語を含み、根拠の添付が無いため（ガイドライン1）",
    label: "違反",
  },
  自社内最上級: {
    reason: "比較対象が自社製品に閉じる自社内比較であり許容される（補足）",
    label: "適合",
  },
  価格_条件曖昧: {
    reason: "価格訴求に税込・適用条件の明記が無いため（ガイドライン5）",
    label: "違反",
  },
};

export const BATCHES: Case[][] = [
  // ===== バッチ1 =====
  [
    // 明確に適合 ×3
    { id: "b1-c1", copy: "毎日の筆記を、なめらかに。", trueLabel: "適合" },
    { id: "b1-c2", copy: "0.5mm 細書きペン、新登場。", trueLabel: "適合" },
    { id: "b1-c3", copy: "10色セットができました。", trueLabel: "適合" },
    // 明確に違反 ×2
    { id: "b1-v1", copy: "絶対に手が疲れないペン。", trueLabel: "違反" },
    { id: "b1-v2", copy: "誰でも字が上手くなる。", trueLabel: "違反" },
    // グレー ×5
    {
      id: "b1-g1",
      copy: "業界No.1の書き心地。",
      trueLabel: "違反",
      greyType: "最上級_根拠なし",
    },
    {
      id: "b1-g2",
      copy: "他社製より2倍なめらか。",
      trueLabel: "違反",
      greyType: "比較_出典なし",
    },
    {
      id: "b1-g3",
      copy: "史上最高のなめらかさを、あなたに。",
      trueLabel: "違反",
      greyType: "主観的誇大",
    },
    {
      id: "b1-g4",
      copy: "当社史上最高の品質。",
      trueLabel: "適合",
      greyType: "自社内最上級",
    },
    {
      id: "b1-g5",
      copy: "今だけ半額。",
      trueLabel: "違反",
      greyType: "価格_条件曖昧",
    },
  ],

  // ===== バッチ2（同じグレー類型を別コピーで再登場）=====
  [
    // 明確に適合 ×3
    { id: "b2-c1", copy: "書き出しから、すっとなじむ。", trueLabel: "適合" },
    { id: "b2-c2", copy: "0.38mm 極細、登場。", trueLabel: "適合" },
    { id: "b2-c3", copy: "新色、5色を追加しました。", trueLabel: "適合" },
    // 明確に違反 ×2
    { id: "b2-v1", copy: "必ず成績が上がるノート。", trueLabel: "違反" },
    { id: "b2-v2", copy: "100%にじまない、と断言します。", trueLabel: "違反" },
    // グレー ×5（再登場）
    {
      id: "b2-g1",
      copy: "売上No.1のスケッチブック。",
      trueLabel: "違反",
      greyType: "最上級_根拠なし",
    },
    {
      id: "b2-g2",
      copy: "従来の他社インクより3倍長持ち。",
      trueLabel: "違反",
      greyType: "比較_出典なし",
    },
    {
      id: "b2-g3",
      copy: "史上最高の手触り、ここに。",
      trueLabel: "違反",
      greyType: "主観的誇大",
    },
    {
      id: "b2-g4",
      copy: "従来比、当社最高の発色。",
      trueLabel: "適合",
      greyType: "自社内最上級",
    },
    {
      id: "b2-g5",
      copy: "週末だけ、特別価格。",
      trueLabel: "違反",
      greyType: "価格_条件曖昧",
    },
  ],

  // ===== バッチ3（さらに別コピーで再登場）=====
  [
    // 明確に適合 ×3
    { id: "b3-c1", copy: "手帳に、ちょうどいい太さ。", trueLabel: "適合" },
    { id: "b3-c2", copy: "詰め替え芯、入荷しました。", trueLabel: "適合" },
    { id: "b3-c3", copy: "限定デザイン、数量限定で。", trueLabel: "適合" },
    // 明確に違反 ×2
    { id: "b3-v1", copy: "誰でも必ず美文字になる。", trueLabel: "違反" },
    { id: "b3-v2", copy: "絶対に折れない芯。", trueLabel: "違反" },
    // グレー ×5（再登場）
    {
      id: "b3-g1",
      copy: "満足度No.1の万年筆。",
      trueLabel: "違反",
      greyType: "最上級_根拠なし",
    },
    {
      id: "b3-g2",
      copy: "他社比でインク消費が半分。",
      trueLabel: "違反",
      greyType: "比較_出典なし",
    },
    {
      id: "b3-g3",
      copy: "史上最高に書きやすい一本。",
      trueLabel: "違反",
      greyType: "主観的誇大",
    },
    {
      id: "b3-g4",
      copy: "当社比、過去最高のなめらかさ。",
      trueLabel: "適合",
      greyType: "自社内最上級",
    },
    {
      id: "b3-g5",
      copy: "本日限り、おトクな価格で。",
      trueLabel: "違反",
      greyType: "価格_条件曖昧",
    },
  ],
];

export const TOTAL_BATCHES = BATCHES.length;

/** コピー本文から元ケースを引く（サーバー側オフラインフォールバック用） */
export function findCaseByCopy(copy: string): Case | undefined {
  for (const batch of BATCHES) {
    const hit = batch.find((c) => c.copy === copy);
    if (hit) return hit;
  }
  return undefined;
}
