import { useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingDown, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { useCoral, unwrap } from "../hooks/useCoral";

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#151524] border border-[#1e1e32] rounded-lg p-3 text-[12px] font-mono">
      <div className="text-[#94a3b8] mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-[#475569]">{p.dataKey}:</span>
          <span className="text-[#e2e8f0]">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-3 w-56" />
        </div>
        <div className="skeleton h-20 w-24 rounded-xl" />
      </div>
      <div className="skeleton h-48 w-full rounded-xl" />
    </div>
  );
}

// ── Score Display ──────────────────────────────────────────────────────────
function DebtScore({ score }) {
  const color =
    score < 20 ? "#10b981" : score < 50 ? "#f59e0b" : "#ef4444";
  const glowClass =
    score < 20 ? "glow-green" : score < 50 ? "glow-amber" : "glow-red";
  const label =
    score < 20 ? "Excellent" : score < 50 ? "At Risk" : "Critical";

  return (
    <div className={`flex flex-col items-center justify-center p-5 rounded-xl bg-[#0f0f1a] border border-[#1e1e32] ${glowClass} min-w-[100px]`}>
      <div className="font-mono text-4xl font-bold leading-none" style={{ color }}>
        {Math.round(score)}
      </div>
      <div className="font-mono text-[10px] text-[#475569] mt-1">Focus Debt</div>
      <div
        className="badge mt-2 text-[9px]"
        style={{ background: `${color}18`, color }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FocusDebt() {
  const { data, loading, error, failedSources, timedOutSources, refetch } = useCoral("/api/focus-debt");

  useEffect(() => {
    refetch();
  }, []);

  const planned = data?.planned ?? 0;
  const completed = data?.completed ?? 0;
  const score = planned > 0 ? (1 - completed / planned) * 100 : 0;
  const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
  
  // Pad byDay to 7 days
  const byDayRaw = unwrap(data?.byDay);
  const paddedByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toLocaleDateString("en-US", { weekday: "short" });
    const existing = byDayRaw.find(b => b.day === dayStr);
    paddedByDay.push(existing || { day: dayStr, planned: 0, completed: 0 });
  }

  return (
    <div className="p-6 space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[#e2e8f0] flex items-center gap-2">
            <TrendingDown size={16} className="text-[#f59e0b]" />
            Focus Debt
            <div className="flex gap-1.5 ml-2">
              <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes('notion') ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} title="Notion" />
              <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes('github') ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} title="GitHub" />
            </div>
          </h2>
          <p className="text-[12px] text-[#475569] mt-0.5">
            Last 7 days — planned vs completed work
          </p>
        </div>
        <button
          id="focus-debt-refresh-btn"
          onClick={() => refetch()}
          disabled={loading}
          className="p-2 rounded-lg bg-[#0f0f1a] border border-[#1e1e32] text-[#475569] hover:text-[#00d4ff] hover:border-[#00d4ff33] transition-all disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-[#ef444412] border border-[#ef444433] flex items-center gap-2 text-[12px] text-[#ef4444]">
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
      
      {timedOutSources?.length > 0 && (
        <div className="p-3 rounded-lg bg-[#f59e0b12] border border-[#f59e0b33] flex items-center gap-2 text-[12px] text-[#f59e0b]">
          <Clock size={13} />
          Some sources timed out: {timedOutSources.join(', ')}
        </div>
      )}

      {loading && !data ? (
        <Skeleton />
      ) : !data && !error ? (
        <div className="p-4 text-center text-[13px] text-[#475569] fade-in">
          No Focus Debt data available.
        </div>
      ) : (
        <>
          {/* Score + Summary */}
          <div className="flex items-center gap-6">
            <DebtScore score={score} />
            <div>
              <p className="text-[14px] text-[#94a3b8] leading-relaxed">
                You completed{" "}
                <span className="font-mono font-semibold text-[#00d4ff]">{pct}%</span>{" "}
                of planned work this week.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#1e1e32] border border-[#475569]" />
                  <span className="text-[11px] font-mono text-[#475569]">
                    Planned: <span className="text-[#e2e8f0]">{planned}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#00d4ff]" />
                  <span className="text-[11px] font-mono text-[#475569]">
                    Completed: <span className="text-[#00d4ff]">{completed}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          {byDay.length > 0 ? (
            <div className="card p-4">
              <div className="text-[10px] font-mono text-[#475569] uppercase tracking-widest mb-4">
                Daily Breakdown
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={paddedByDay}
                  barCategoryGap="30%"
                  barGap={3}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e1e3260"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#475569", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#00d4ff08" }} />
                  <Bar dataKey="planned" fill="#1e1e32" radius={[3, 3, 0, 0]} name="planned" />
                  <Bar dataKey="completed" fill="#00d4ff" radius={[3, 3, 0, 0]} name="completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[13px] text-[#475569] text-center py-8">
              {failedSources?.length > 0 ? `No data from ${failedSources.join(', ')}` : "No data from GitHub/Notion"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
