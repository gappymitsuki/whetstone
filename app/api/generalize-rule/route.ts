import { NextRequest, NextResponse } from "next/server";
import { buildGeneralizePrompt } from "@/lib/prompts";
import { callLLMJson } from "@/lib/openai";
import { GUIDELINE } from "@/data/guideline";
import { findCaseByCopy, GREY_TYPE_INFO } from "@/data/cases";
import { OFFLINE_DEMO_MODE } from "@/lib/config";
import type { GeneralizeResponse } from "@/lib/types";

export const runtime = "nodejs";

function normalize(
  r: Partial<GeneralizeResponse>,
  fallbackLabel: "適合" | "違反"
): GeneralizeResponse {
  const label = r.label === "適合" || r.label === "違反" ? r.label : fallbackLabel;
  return {
    pattern:
      typeof r.pattern === "string" && r.pattern.trim()
        ? r.pattern
        : "同種の表現全般",
    label,
    reason: typeof r.reason === "string" ? r.reason : "専門家判断に基づく",
  };
}

/** サーバー側オフラインフォールバック */
function offlineFallback(
  copy: string,
  expertLabel: "適合" | "違反",
  expertReason: string
): GeneralizeResponse {
  const c = findCaseByCopy(copy);
  const info = c?.greyType ? GREY_TYPE_INFO[c.greyType] : undefined;
  return {
    pattern: info
      ? `「${c?.greyType}」類型：${info.reason}に該当するもの`
      : `「${copy}」と同種の表現`,
    label: expertLabel,
    reason: expertReason || info?.reason || "専門家判断に基づく",
  };
}

export async function POST(req: NextRequest) {
  let copy = "";
  let expertLabel: "適合" | "違反" = "違反";
  let expertReason = "";
  try {
    const body = await req.json();
    copy = String(body?.copy ?? "");
    expertLabel = body?.expertLabel === "適合" ? "適合" : "違反";
    expertReason = String(body?.expertReason ?? "");
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (OFFLINE_DEMO_MODE || !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      offlineFallback(copy, expertLabel, expertReason)
    );
  }

  try {
    const { system, user } = buildGeneralizePrompt(
      GUIDELINE,
      copy,
      expertLabel,
      expertReason
    );
    const raw = await callLLMJson<Partial<GeneralizeResponse>>(system, user);
    return NextResponse.json(normalize(raw, expertLabel));
  } catch {
    return NextResponse.json(
      offlineFallback(copy, expertLabel, expertReason)
    );
  }
}
