"use client";

import type { BatchResult } from "@/lib/types";

const W = 420;
const H = 240;
const PAD = { top: 24, right: 16, bottom: 32, left: 36 };

function pts(
  history: BatchResult[],
  pick: (b: BatchResult) => number
): { x: number; y: number; v: number }[] {
  const n = history.length;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return history.map((b, i) => {
    const x = n <= 1 ? PAD.left + innerW / 2 : PAD.left + (innerW * i) / (n - 1);
    const v = pick(b); // 0..1
    const y = PAD.top + innerH * (1 - v);
    return { x, y, v };
  });
}

function path(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

export default function Dashboard({ history }: { history: BatchResult[] }) {
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];

  const escPts = pts(history, (b) => b.escalationRate);
  const accPts = pts(history, (b) => b.accuracy);

  const innerH = H - PAD.top - PAD.bottom;
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((g) => ({
    g,
    y: PAD.top + innerH * (1 - g),
  }));

  const escDelta =
    latest && prev ? latest.escalationRate - prev.escalationRate : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 直近バッチの大きな数値 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
          <div className="text-xs text-slate-400">Escalation rate (latest)</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold tabular-nums text-accent">
              {latest ? Math.round(latest.escalationRate * 100) : "—"}
              {latest && <span className="text-lg">%</span>}
            </span>
            {escDelta !== null && (
              <span
                className={`mb-1 font-mono text-xs ${
                  escDelta < 0 ? "text-ok" : escDelta > 0 ? "text-bad" : "text-slate-500"
                }`}
              >
                {escDelta < 0 ? "▼" : escDelta > 0 ? "▲" : ""}
                {Math.abs(Math.round(escDelta * 100))}pt
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
          <div className="text-xs text-slate-400">Self-driven accuracy</div>
          <div className="mt-1">
            <span className="font-mono text-3xl font-semibold tabular-nums text-ok">
              {latest ? Math.round(latest.accuracy * 100) : "—"}
              {latest && <span className="text-lg">%</span>}
            </span>
          </div>
        </div>
      </div>

      {/* 折れ線グラフ */}
      <div className="rounded-lg border border-ink-600 bg-ink-800 p-3">
        <div className="mb-2 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2 w-3 rounded-full bg-accent" />
            Escalation rate
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2 w-3 rounded-full bg-ok" />
            Accuracy
          </span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Escalation rate and accuracy across production runs"
        >
          {/* グリッド + Y軸ラベル */}
          {gridY.map(({ g, y }) => (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#1f2b3d"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-500"
                fontSize={9}
              >
                {Math.round(g * 100)}
              </text>
            </g>
          ))}

          {/* X軸ラベル（バッチ番号） */}
          {escPts.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={H - PAD.bottom + 16}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={9}
            >
              R{history[i].batchNumber}
            </text>
          ))}

          {history.length === 0 && (
            <text
              x={W / 2}
              y={H / 2}
              textAnchor="middle"
              className="fill-slate-600"
              fontSize={11}
            >
              No runs yet
            </text>
          )}

          {/* 正答率ライン */}
          <path d={path(accPts)} fill="none" stroke="#34d399" strokeWidth={2} />
          {accPts.map((p, i) => (
            <circle key={`a${i}`} cx={p.x} cy={p.y} r={3} fill="#34d399" />
          ))}

          {/* エスカレ率ライン（主役） */}
          <path
            d={path(escPts)}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2.5}
          />
          {escPts.map((p, i) => (
            <circle key={`e${i}`} cx={p.x} cy={p.y} r={3.5} fill="#22d3ee" />
          ))}
        </svg>
      </div>
    </div>
  );
}
