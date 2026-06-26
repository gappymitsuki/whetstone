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
  fallbackLabel: "Compliant" | "Violation"
): GeneralizeResponse {
  const label =
    r.label === "Compliant" || r.label === "Violation" ? r.label : fallbackLabel;
  return {
    pattern:
      typeof r.pattern === "string" && r.pattern.trim()
        ? r.pattern
        : "Copy of the same kind, in general",
    label,
    reason: typeof r.reason === "string" ? r.reason : "Based on the expert's judgment",
  };
}

/** Server-side offline fallback. */
function offlineFallback(
  copy: string,
  expertLabel: "Compliant" | "Violation",
  expertReason: string
): GeneralizeResponse {
  const c = findCaseByCopy(copy);
  const info = c?.greyType ? GREY_TYPE_INFO[c.greyType] : undefined;
  return {
    pattern: info
      ? `Copy of the "${c?.greyType}" type: anything matching — ${info.reason}`
      : `Copy of the same kind as "${copy}"`,
    label: expertLabel,
    reason: expertReason || info?.reason || "Based on the expert's judgment",
  };
}

export async function POST(req: NextRequest) {
  let copy = "";
  let expertLabel: "Compliant" | "Violation" = "Violation";
  let expertReason = "";
  try {
    const body = await req.json();
    copy = String(body?.copy ?? "");
    expertLabel = body?.expertLabel === "Compliant" ? "Compliant" : "Violation";
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
