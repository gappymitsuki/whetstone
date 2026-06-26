import { NextRequest, NextResponse } from "next/server";
import { buildJudgePrompt } from "@/lib/prompts";
import { callLLMJson } from "@/lib/openai";
import { computeOfflineJudgment } from "@/lib/engine";
import { GUIDELINE } from "@/data/guideline";
import { findCaseByCopy, inferCaseFromCopy } from "@/data/cases";
import { OFFLINE_DEMO_MODE } from "@/lib/config";
import type { JudgeResponse, Rule } from "@/lib/types";

export const runtime = "nodejs";

function normalize(r: Partial<JudgeResponse>): JudgeResponse {
  const label =
    r.label === "Compliant" || r.label === "Violation" || r.label === "Needs Review"
      ? r.label
      : "Needs Review";
  let confidence =
    typeof r.confidence === "number" && isFinite(r.confidence)
      ? Math.round(r.confidence)
      : 50;
  confidence = Math.max(0, Math.min(100, confidence));
  return {
    label,
    confidence,
    rationale: typeof r.rationale === "string" ? r.rationale : "",
    reliedOnRuleIds: Array.isArray(r.reliedOnRuleIds)
      ? r.reliedOnRuleIds.filter((x) => typeof x === "string")
      : [],
  };
}

/** サーバー側オフラインフォールバック（API 不通・キー未設定時） */
function offlineFallback(copy: string, rules: Rule[]): JudgeResponse {
  const c = findCaseByCopy(copy) ?? inferCaseFromCopy(copy, "offline");
  return computeOfflineJudgment(c, rules);
}

export async function POST(req: NextRequest) {
  let copy = "";
  let rules: Rule[] = [];
  try {
    const body = await req.json();
    copy = String(body?.copy ?? "");
    rules = Array.isArray(body?.rules) ? body.rules : [];
  } catch {
    return NextResponse.json(
      { error: "invalid body" },
      { status: 400 }
    );
  }

  // オフラインモード or キー未設定 → 即フォールバック（200で返す）
  if (OFFLINE_DEMO_MODE || !process.env.OPENAI_API_KEY) {
    return NextResponse.json(offlineFallback(copy, rules));
  }

  try {
    const { system, user } = buildJudgePrompt(GUIDELINE, rules, copy);
    const raw = await callLLMJson<Partial<JudgeResponse>>(system, user);
    return NextResponse.json(normalize(raw));
  } catch {
    // リトライ上限後も失敗 → アプリを落とさずオフライン判定で代替
    return NextResponse.json(offlineFallback(copy, rules));
  }
}
