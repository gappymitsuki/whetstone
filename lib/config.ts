/**
 * Whetstone デモの一元設定。
 * モデル名・閾値・オフラインモードはここだけ触れば差し替え可能。
 */

// LLM モデル名（容易に差し替え可能にするため定数化）
export const MODEL = "gpt-4o";

// 判定温度（再現性のため低め）
export const TEMPERATURE = 0.1;

// エスカレ閾値の既定値（confidence がこれ未満ならエスカレ）
export const DEFAULT_THRESHOLD = 70;

// 確信度の上限・下限の目安（プロンプト整合のためのドキュメント値）
export const HIGH_CONFIDENCE = 88;
export const LOW_CONFIDENCE = 55;

// API リトライ回数
export const MAX_RETRIES = 2;

/**
 * オフラインデモモード。
 * true の場合、LLM を一切呼ばず data/cases.ts の事前計算ロジックで判定する。
 * ネット不通でも通しリハ・本番が成立する「事故耐性」の要。
 *
 * 環境変数 NEXT_PUBLIC_OFFLINE_DEMO=1 でも有効化できる。
 * （API キー未設定でもサーバー側で自動フォールバックするので、
 *   この値が false でも API 不通時はオフライン判定に落ちる。）
 */
export const OFFLINE_DEMO_MODE =
  process.env.NEXT_PUBLIC_OFFLINE_DEMO === "1" ? true : false;

// ブランド表示名
export const APP_NAME = "Whetstone";
export const APP_TAGLINE = "専門家の判断を砥石に、AIエージェントを研ぎ上げる";
