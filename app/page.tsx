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
import { EXPERTS, getExpert } from "@/data/experts";
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

/* 役割を説明するコンテキストバー（「今は誰の視点か」を明示） */
function RoleContextBar({ view }: { view: View }) {
  if (view === "operator") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
        <span className="text-lg leading-none">🛠</span>
        <div className="text-sm">
          <span className="font-semibold text-accent-soft">
            運用者ビュー（AIチーム / 運用リード）
          </span>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            あなたは Whetstone を導入した側。本番ランを回し、ダッシュボードで
            「どこまでAIに任せられるか」を統制する。確信が持てない判断は専門家へ自動で委ねられる。
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
          専門家ビュー（法務・ブランドの“師匠”）
        </span>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
          あなたは現場のドメインエキスパート。届いた判断だけを最小文脈で裁く。
          あなたの一裁きは汎用ルールとして蓄積され、次から同種をAIが自走できるようになる。
        </p>
      </div>
    </div>
  );
}

/* 運用者ビュー：エスカレ状況の読み取り専用サマリ（操作は専門家ビューで） */
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
        専門家へ委譲中
      </h2>
      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-600 p-4 text-center text-xs text-slate-500">
          いま専門家の判断待ちのケースはありません
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
                  <span className="font-mono text-lg text-slate-100">{n}</span> 件 判断待ち
                </span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onGoExpert}
            className="mt-1 self-start rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
          >
            専門家ビューで対応する →
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
      {/* ヘッダー */}
      <header className="flex flex-col gap-4 rounded-xl border border-ink-600 bg-ink-800 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
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

          {/* ロール切替 */}
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
              🛠 運用者ビュー
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
              🎓 専門家ビュー
              {queue.length > 0 && (
                <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-bold text-white">
                  {queue.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 運用者だけが触れる本番ラン制御 */}
        {isOperator && (
          <div className="flex flex-wrap items-center gap-4 border-t border-ink-600 pt-3">
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
              本番ラン
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
              {running ? "稼働中…" : "▶ 本番ランを実行"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={running}
              className="rounded-lg border border-ink-500 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-ink-600 disabled:opacity-50"
            >
              リセット
            </button>
            <span className="hidden text-[11px] text-slate-500 lg:inline">
              ＝ 本番でエージェントがトラフィック（コピー10件）を処理する1サイクル
            </span>
          </div>
        )}
      </header>

      <RoleContextBar view={view} />

      {/* ===== 運用者ビュー ===== */}
      {isOperator && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">
                エージェントの判定（本番ラン）
                {lastJudgments.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ラン #{batchHistory[batchHistory.length - 1]?.batchNumber} ・{" "}
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

            <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">
                切れ味ダッシュボード
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

      {/* ===== 専門家ビュー ===== */}
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
                受信トレイは空です。運用者が本番ランを回すと、確信の持てない判断がここに届きます。
              </p>
            )}
          </section>

          <section className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
            <div className="max-h-[40vh] overflow-y-auto pr-1">
              <RuleBook rules={rules} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              ↑ あなたの判断が研いだルール。
              <span className="text-accent">運用者ビュー</span>
              で本番ランを回すと、これらが効いてエスカレ率が下がります。
            </p>
          </section>
        </div>
      )}

      <footer className="pb-4 text-center text-[11px] text-slate-600">
        専門家の判断をランタイムで研ぎ上げる — Whetstone Demo
      </footer>
    </main>
  );
}
