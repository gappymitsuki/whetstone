"use client";

import type { Rule } from "@/lib/types";
import { expertForGreyType } from "@/data/experts";

export default function RuleBook({ rules }: { rules: Rule[] }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Rule Book</h2>
        <span className="rounded-full bg-ink-600 px-2 py-0.5 text-xs text-slate-300">
          {rules.length}
        </span>
        <span className="text-[11px] text-slate-500">All derived from expert judgments</span>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-600 p-4 text-center text-xs text-slate-500">
          No rules yet. They accumulate as experts make judgments.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-ink-600 bg-ink-800 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-snug text-slate-100">{r.pattern}</p>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${
                    r.label === "Compliant"
                      ? "border-ok/30 bg-ok/15 text-ok"
                      : "border-bad/30 bg-bad/15 text-bad"
                  }`}
                >
                  {r.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{r.reason}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {(() => {
                  const ex = expertForGreyType(r.greyType);
                  return ex ? (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${ex.badge}`}
                    >
                      from {ex.short} expert
                    </span>
                  ) : null;
                })()}
                <span className="font-mono text-[10px] text-slate-600">
                  {r.id} · from case {r.sourceCaseId}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
