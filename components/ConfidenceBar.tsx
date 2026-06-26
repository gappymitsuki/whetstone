"use client";

import type { Label } from "@/lib/types";

function barColor(label: Label, confidence: number, threshold: number): string {
  if (label === "Needs Review") return "bg-warn";
  if (label === "Violation") return "bg-bad";
  // Compliant
  return confidence >= threshold ? "bg-ok" : "bg-warn";
}

export default function ConfidenceBar({
  label,
  confidence,
  threshold,
  rationale,
}: {
  label: Label;
  confidence: number;
  threshold: number;
  rationale: string;
}) {
  return (
    <div className="group relative w-full">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-600">
          <div
            className={`h-full rounded-full transition-all ${barColor(
              label,
              confidence,
              threshold
            )}`}
            style={{ width: `${Math.max(2, Math.min(100, confidence))}%` }}
          />
        </div>
        <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-slate-400">
          {confidence}
        </span>
      </div>

      {/* 閾値マーカー */}
      <div
        className="pointer-events-none absolute top-0 h-2"
        style={{ left: `calc(${threshold}% - 1px)`, maxWidth: "calc(100% - 44px)" }}
        aria-hidden
      >
        <div className="h-2 w-px bg-slate-500/70" />
      </div>

      {/* ホバーで rationale ツールチップ */}
      {rationale && (
        <div className="pointer-events-none absolute left-0 top-5 z-20 w-72 rounded-md border border-ink-500 bg-ink-800 p-2 text-xs leading-relaxed text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
          {rationale}
        </div>
      )}
    </div>
  );
}
