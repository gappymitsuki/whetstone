"use client";

import type { Case, Judgment, Label, Rule } from "@/lib/types";
import { getExpert } from "@/data/experts";
import ConfidenceBar from "./ConfidenceBar";

function LabelBadge({ label }: { label: Label }) {
  const styles: Record<Label, string> = {
    適合: "bg-ok/15 text-ok border-ok/30",
    違反: "bg-bad/15 text-bad border-bad/30",
    要確認: "bg-warn/15 text-warn border-warn/30",
  };
  return (
    <span
      className={`inline-block shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${styles[label]}`}
    >
      {label}
    </span>
  );
}

export default function CaseList({
  cases,
  judgments,
  rules,
  threshold,
}: {
  cases: Case[];
  judgments: Judgment[];
  rules: Rule[];
  threshold: number;
}) {
  if (judgments.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-500">
        「バッチ実行」を押すと判定結果がここに並びます
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-ink-600">
      {judgments.map((j) => {
        const c = cases.find((x) => x.id === j.caseId);
        if (!c) return null;
        const reliedRules = j.reliedOnRuleIds
          .map((id) => rules.find((r) => r.id === id))
          .filter((r): r is Rule => Boolean(r));

        return (
          <li key={j.caseId} className="flex flex-col gap-2 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-snug text-slate-100">{c.copy}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                {j.pending ? (
                  <span className="rounded border border-slate-500/40 bg-slate-500/10 px-2 py-0.5 text-xs text-slate-400">
                    判定保留
                  </span>
                ) : (
                  <LabelBadge label={j.label} />
                )}
                {j.escalated && (
                  <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    エスカレ
                  </span>
                )}
                {j.escalated &&
                  (() => {
                    const ex = getExpert(j.routedExpertId);
                    return ex ? (
                      <span
                        title={ex.scope}
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${ex.badge}`}
                      >
                        → {ex.short}
                      </span>
                    ) : null;
                  })()}
              </div>
            </div>

            <ConfidenceBar
              label={j.label}
              confidence={j.confidence}
              threshold={threshold}
              rationale={j.rationale}
            />

            {reliedRules.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {reliedRules.map((r) => (
                  <span
                    key={r.id}
                    title={r.pattern}
                    className="max-w-full truncate rounded bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent-soft"
                  >
                    ⮡ 依拠ルール {r.id}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
