"use client";

import { useReducer, useCallback } from "react";
import type {
  BatchResult,
  Case,
  FinalLabel,
  Judgment,
  Rule,
} from "@/lib/types";
import {
  judgeBatch,
  generalizeRule,
  computeBatchResult,
} from "@/lib/engine";
import { BATCHES, TOTAL_BATCHES } from "@/data/cases";
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

interface State {
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
  | { type: "SET_THRESHOLD"; value: number }
  | { type: "START_BATCH" }
  | { type: "FINISH_BATCH"; result: BatchResult; cases: Case[] }
  | { type: "START_JUDGE"; caseId: string }
  | { type: "FINISH_JUDGE"; caseId: string; rule: Rule }
  | { type: "RESET" };

const initialState: State = {
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
        queue: escalated, // 新バッチのエスカレ分でキューを更新
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
      return { ...initialState, threshold: state.threshold };
    default:
      return state;
  }
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    threshold,
    batchHistory,
    rules,
    queue,
    lastJudgments,
    lastBatchCases,
    running,
    busyIds,
  } = state;

  const nextBatchNumber = batchHistory.length + 1;

  const runBatch = useCallback(async () => {
    if (running) return;
    dispatch({ type: "START_BATCH" });
    const idx = batchHistory.length % TOTAL_BATCHES;
    const cases = BATCHES[idx];
    const judgments = await judgeBatch(cases, rules, threshold);
    const result = computeBatchResult(nextBatchNumber, judgments, cases);
    dispatch({ type: "FINISH_BATCH", result, cases });
  }, [running, batchHistory.length, rules, threshold, nextBatchNumber]);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-4 py-5 lg:px-8">
      {/* ヘッダー */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-600 bg-ink-800 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-50">
            {APP_NAME}
          </h1>
          <span className="hidden text-xs text-slate-400 sm:inline">
            {APP_TAGLINE}
          </span>
          {OFFLINE_DEMO_MODE && (
            <span className="rounded border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] text-warn">
              オフラインデモ
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* 閾値スライダー */}
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span className="whitespace-nowrap">確信度閾値</span>
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
            バッチ
            <span className="font-mono text-sm text-slate-100">
              {nextBatchNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={runBatch}
            disabled={running}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink-900 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {running ? "判定中…" : "バッチ実行"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={running}
            className="rounded-lg border border-ink-500 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-ink-600 disabled:opacity-50"
          >
            リセット
          </button>
        </div>
      </header>

      {/* メイン2カラム */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 左：判定結果一覧 */}
        <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-200">
            判定結果一覧
            {lastJudgments.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                バッチ {batchHistory[batchHistory.length - 1]?.batchNumber} ・{" "}
                {lastJudgments.length}件
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

        {/* 右：切れ味ダッシュボード */}
        <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">
            切れ味ダッシュボード
          </h2>
          <Dashboard history={batchHistory} />
        </section>
      </div>

      {/* 下段2カラム：レビューキュー / ルール集 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
          <ReviewQueue
            queue={queue}
            cases={lastBatchCases}
            onConfirm={confirmReview}
            busyIds={busyIds}
          />
        </section>
        <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <RuleBook rules={rules} />
          </div>
        </section>
      </div>

      <footer className="pb-4 text-center text-[11px] text-slate-600">
        専門家の判断をランタイムで研ぎ上げる — Whetstone Demo
      </footer>
    </main>
  );
}
