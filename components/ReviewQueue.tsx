"use client";

import { useState } from "react";
import type { Case, FinalLabel, Judgment } from "@/lib/types";
import { EXPERTS } from "@/data/experts";

export default function ReviewQueue({
  queue,
  cases,
  onConfirm,
  busyIds,
}: {
  queue: Judgment[];
  cases: Case[];
  onConfirm: (caseId: string, label: FinalLabel, reason: string) => void;
  busyIds: Set<string>;
}) {
  const [labels, setLabels] = useState<Record<string, FinalLabel>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const renderItem = (j: Judgment) => {
    const c = cases.find((x) => x.id === j.caseId);
    if (!c) return null;
    const label = labels[j.caseId] ?? "Violation";
    const reason = reasons[j.caseId] ?? "";
    const busy = busyIds.has(j.caseId);

    return (
      <li key={j.caseId} className="rounded-lg border border-ink-600 bg-ink-800 p-3">
        <p className="text-sm font-medium text-slate-100">{c.copy}</p>
        {j.routeReason && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            <span className="text-slate-600">Router: </span>
            {j.routeReason}
          </p>
        )}
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          <span className="text-slate-500">Agent&apos;s uncertainty: </span>
          {j.rationale}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-ink-500">
            {(["Compliant", "Violation"] as FinalLabel[]).map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={busy}
                onClick={() => setLabels((m) => ({ ...m, [j.caseId]: opt }))}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  label === opt
                    ? opt === "Compliant"
                      ? "bg-ok/20 text-ok"
                      : "bg-bad/20 text-bad"
                    : "text-slate-400 hover:bg-ink-600"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={reason}
            disabled={busy}
            onChange={(e) =>
              setReasons((m) => ({ ...m, [j.caseId]: e.target.value }))
            }
            placeholder="One-line reason (e.g. no objective supporting data)"
            className="min-w-[160px] flex-1 rounded-md border border-ink-500 bg-ink-900 px-2 py-1 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent"
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(j.caseId, label, reason)}
            className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-ink-900 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200">
          Expert review queue
        </h2>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
          {queue.length}
        </span>
        <span className="text-[11px] text-slate-500">
          Auto-routed to the right expert by topic
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-600 p-4 text-center text-xs text-slate-500">
          No cases awaiting expert review.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {EXPERTS.map((expert) => {
            const items = queue.filter((j) => j.routedExpertId === expert.id);
            if (items.length === 0) return null;
            return (
              <div key={expert.id}>
                {/* レーン見出し */}
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${expert.dot}`} />
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold ${expert.badge}`}
                  >
                    {expert.name}
                  </span>
                  <span className="rounded-full bg-ink-600 px-1.5 py-0.5 text-[11px] text-slate-300">
                    {items.length}
                  </span>
                  <span className="hidden text-[11px] text-slate-500 sm:inline">
                    {expert.scope}
                  </span>
                </div>
                <ul className="flex flex-col gap-3 border-l border-ink-600 pl-3">
                  {items.map(renderItem)}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {queue.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          Confirming accumulates a rule —{" "}
          <span className="text-accent">applied on the next run</span>.
        </p>
      )}
    </div>
  );
}
