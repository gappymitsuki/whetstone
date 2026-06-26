"use client";

import { useReducer, useCallback, useState } from "react";
import type {
  BatchResult,
  Case,
  FinalLabel,
  Judgment,
  Rule,
} from "@/lib/types";
import {
  judgeBatch,
  judgeAdhoc,
  generalizeRule,
  computeBatchResult,
} from "@/lib/engine";
import { BATCHES, TOTAL_BATCHES } from "@/data/cases";
import { EXPERTS } from "@/data/experts";
import {
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_THRESHOLD,
  OFFLINE_DEMO_MODE,
} from "@/lib/config";

import CaseList from "@/components/CaseList";
import Dashboard from "@/components/Dashboard";
import ReviewQueue from "@/components/ReviewQueue";
import RuleBook from "@/components/RuleBook";

type View = "operator" | "expert";

interface State {
  view: View;
  threshold: number;
  batchHistory: BatchResult[];
  rules: Rule[];
  queue: Judgment[];
  lastJudgments: Judgment[];
  lastBatchCases: Case[];
  running: boolean;
  busyIds: Set<string>;
}

type Action =
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_THRESHOLD"; value: number }
  | { type: "START_BATCH" }
  | { type: "FINISH_BATCH"; result: BatchResult; cases: Case[] }
  | { type: "ADHOC_RESULT"; caseObj: Case; judgment: Judgment }
  | { type: "START_JUDGE"; caseId: string }
  | { type: "FINISH_JUDGE"; caseId: string; rule: Rule }
  | { type: "RESET" };

const initialState: State = {
  view: "operator",
  threshold: DEFAULT_THRESHOLD,
  batchHistory: [],
  rules: [],
  queue: [],
  lastJudgments: [],
  lastBatchCases: [],
  running: false,
  busyIds: new Set(),
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "SET_THRESHOLD":
      return { ...state, threshold: action.value };
    case "START_BATCH":
      return { ...state, running: true };
    case "FINISH_BATCH": {
      const escalated = action.result.judgments.filter((j) => j.escalated);
      return {
        ...state,
        running: false,
        batchHistory: [...state.batchHistory, action.result],
        lastJudgments: action.result.judgments,
        lastBatchCases: action.cases,
        queue: escalated,
      };
    }
    case "ADHOC_RESULT": {
      // A single live-typed input: prepend to the list; queue it if escalated.
      return {
        ...state,
        lastBatchCases: [action.caseObj, ...state.lastBatchCases],
        lastJudgments: [action.judgment, ...state.lastJudgments],
        queue: action.judgment.escalated
          ? [action.judgment, ...state.queue]
          : state.queue,
      };
    }
    case "START_JUDGE": {
      const next = new Set(state.busyIds);
      next.add(action.caseId);
      return { ...state, busyIds: next };
    }
    case "FINISH_JUDGE": {
      const next = new Set(state.busyIds);
      next.delete(action.caseId);
      return {
        ...state,
        rules: [...state.rules, action.rule],
        queue: state.queue.filter((j) => j.caseId !== action.caseId),
        busyIds: next,
      };
    }
    case "RESET":
      return { ...initialState, threshold: state.threshold, view: state.view };
    default:
      return state;
  }
}

/* Context bar that makes "whose view is this, and why" explicit. */
function RoleContextBar({ view }: { view: View }) {
  if (view === "operator") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        <span className="text-lg leading-none">🛠</span>
        <div className="text-sm">
          <span className="font-semibold text-accent-soft">
            Operator view (AI team / ops lead)
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            You deployed Whetstone. An AI agent reviews incoming{" "}
            <span className="text-slate-300">ad-copy submissions</span> for
            brand-guideline compliance. You run production traffic and use the
            dashboard to control how much you can safely entrust to the agent —
            anything it&apos;s unsure about is auto-routed to an expert.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3">
      <span className="text-lg leading-none">🎓</span>
      <div className="text-sm">
        <span className="font-semibold text-violet-200">
          Expert view (the Legal / Brand &ldquo;master&rdquo;)
        </span>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
          You are the domain expert. Judge only the cases that reach you, with
          minimal context. Each judgment becomes a generalized rule, so next
          time the agent handles the same kind of case on its own.
        </p>
      </div>
    </div>
  );
}

/* Operator: read-only summary of what's been delegated to experts. */
function EscalationSummary({
  queue,
  onGoExpert,
}: {
  queue: Judgment[];
  onGoExpert: () => void;
}) {
  return (
    <div className="flex flex-col">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">
        Delegated to experts
      </h2>
      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-600 p-4 text-center text-xs text-slate-500">
          Nothing awaiting expert judgment right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {EXPERTS.map((ex) => {
            const n = queue.filter((j) => j.routedExpertId === ex.id).length;
            if (n === 0) return null;
            return (
              <div
                key={ex.id}
                className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-800 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${ex.dot}`} />
                  <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${ex.badge}`}>
                    {ex.name}
                  </span>
                </div>
                <span className="text-sm text-slate-300">
                  <span className="font-mono text-lg text-slate-100">{n}</span> awaiting
                </span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onGoExpert}
            className="mt-1 self-start rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
          >
            Handle these in the Expert view →
          </button>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    view,
    threshold,
    batchHistory,
    rules,
    queue,
    lastJudgments,
    lastBatchCases,
    running,
    busyIds,
  } = state;

  const [draft, setDraft] = useState("");
  const [adhocBusy, setAdhocBusy] = useState(false);

  const nextBatchNumber = batchHistory.length + 1;
  const isOperator = view === "operator";

  const runBatch = useCallback(async () => {
    if (running) return;
    dispatch({ type: "START_BATCH" });
    const idx = batchHistory.length % TOTAL_BATCHES;
    const cases = BATCHES[idx];
    const judgments = await judgeBatch(cases, rules, threshold);
    const result = computeBatchResult(nextBatchNumber, judgments, cases);
    dispatch({ type: "FINISH_BATCH", result, cases });
  }, [running, batchHistory.length, rules, threshold, nextBatchNumber]);

  const submitAdhoc = useCallback(async () => {
    const copy = draft.trim();
    if (!copy || adhocBusy) return;
    setAdhocBusy(true);
    const { caseObj, judgment } = await judgeAdhoc(
      copy,
      rules,
      threshold,
      Date.now()
    );
    dispatch({ type: "ADHOC_RESULT", caseObj, judgment });
    setDraft("");
    setAdhocBusy(false);
  }, [draft, adhocBusy, rules, threshold]);

  const confirmReview = useCallback(
    async (caseId: string, label: FinalLabel, reason: string) => {
      const sourceCase = lastBatchCases.find((c) => c.id === caseId);
      if (!sourceCase || busyIds.has(caseId)) return;
      dispatch({ type: "START_JUDGE", caseId });
      const rule = await generalizeRule(sourceCase, label, reason, Date.now());
      dispatch({ type: "FINISH_JUDGE", caseId, rule });
    },
    [lastBatchCases, busyIds]
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  const setView = useCallback(
    (v: View) => dispatch({ type: "SET_VIEW", view: v }),
    []
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-5 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-xl border border-ink-600 bg-ink-800 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-50">
              {APP_NAME}
            </h1>
            <span className="hidden text-xs text-slate-400 md:inline">
              {APP_TAGLINE}
            </span>
            {OFFLINE_DEMO_MODE && (
              <span className="rounded border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] text-warn">
                offline demo
              </span>
            )}
          </div>

          {/* Role switch */}
          <div className="inline-flex overflow-hidden rounded-lg border border-ink-500">
            <button
              type="button"
              onClick={() => setView("operator")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                isOperator
                  ? "bg-accent/20 text-accent-soft"
                  : "text-slate-400 hover:bg-ink-600"
              }`}
            >
              🛠 Operator
            </button>
            <button
              type="button"
              onClick={() => setView("expert")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                !isOperator
                  ? "bg-violet-500/20 text-violet-200"
                  : "text-slate-400 hover:bg-ink-600"
              }`}
            >
              🎓 Expert
              {queue.length > 0 && (
                <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-bold text-white">
                  {queue.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Production-run controls — operator only */}
        {isOperator && (
          <div className="flex flex-wrap items-center gap-4 border-t border-ink-600 pt-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <span className="whitespace-nowrap">Confidence threshold</span>
              <input
                type="range"
                min={40}
                max={95}
                value={threshold}
                onChange={(e) =>
                  dispatch({ type: "SET_THRESHOLD", value: Number(e.target.value) })
                }
                className="w-28 accent-[#22d3ee]"
              />
              <span className="w-8 font-mono tabular-nums text-accent">
                {threshold}
              </span>
            </label>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              Run
              <span className="font-mono text-sm text-slate-100">
                #{nextBatchNumber}
              </span>
            </div>

            <button
              type="button"
              onClick={runBatch}
              disabled={running}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink-900 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {running ? "Running…" : "▶ Run production batch"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={running}
              className="rounded-lg border border-ink-500 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-ink-600 disabled:opacity-50"
            >
              Reset
            </button>
            <span className="hidden text-[11px] text-slate-500 lg:inline">
              = one cycle of the agent handling production traffic (10 copy submissions)
            </span>
          </div>
        )}
      </header>

      <RoleContextBar view={view} />

      {/* ===== Operator view ===== */}
      {isOperator && (
        <>
          {/* Live input — make "what is the input" tangible */}
          <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-200">
              Submit a copy to the agent
            </h2>
            <p className="mb-2 text-xs text-slate-500">
              The input is a single piece of ad copy (what a marketer would submit).
              Type one and the agent judges it live against the guideline + learned rules.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdhoc();
                }}
                placeholder='e.g. "The #1 pen in the world" or "Now in 12 colors"'
                className="min-w-[220px] flex-1 rounded-md border border-ink-500 bg-ink-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-accent"
              />
              <button
                type="button"
                onClick={submitAdhoc}
                disabled={adhocBusy || !draft.trim()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink-900 transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {adhocBusy ? "Judging…" : "Judge"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['The #1 pen in the world', 'Twice as fast as other brands', 'Our best ink yet', 'Free today only'].map(
                (ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setDraft(ex)}
                    className="rounded border border-ink-600 px-2 py-0.5 text-[11px] text-slate-400 transition-colors hover:border-accent/40 hover:text-accent-soft"
                  >
                    {ex}
                  </button>
                )
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">
                Agent judgments
                {lastJudgments.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {lastJudgments.length} items
                  </span>
                )}
              </h2>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <CaseList
                  cases={lastBatchCases}
                  judgments={lastJudgments}
                  rules={rules}
                  threshold={threshold}
                />
              </div>
            </section>

            <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">
                Sharpness dashboard
              </h2>
              <Dashboard history={batchHistory} />
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
              <EscalationSummary
                queue={queue}
                onGoExpert={() => setView("expert")}
              />
            </section>
            <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
              <div className="max-h-[50vh] overflow-y-auto pr-1">
                <RuleBook rules={rules} />
              </div>
            </section>
          </div>
        </>
      )}

      {/* ===== Expert view ===== */}
      {!isOperator && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
            <ReviewQueue
              queue={queue}
              cases={lastBatchCases}
              onConfirm={confirmReview}
              busyIds={busyIds}
            />
            {queue.length === 0 && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Your inbox is empty. When the operator runs production traffic, the
                cases the agent is unsure about land here.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
            <div className="max-h-[40vh] overflow-y-auto pr-1">
              <RuleBook rules={rules} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              ↑ Rules your judgments have sharpened. Switch to the{" "}
              <span className="text-accent">Operator view</span> and run a batch —
              these kick in and the escalation rate drops.
            </p>
          </section>
        </div>
      )}

      <footer className="pb-4 text-center text-[11px] text-slate-600">
        Sharpening agents against expert judgment, at runtime — Whetstone Demo
      </footer>
    </main>
  );
}
