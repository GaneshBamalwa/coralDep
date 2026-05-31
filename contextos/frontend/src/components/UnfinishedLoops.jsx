import { useEffect } from "react";
import { GitBranch, Hash, FileText, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useCoral, unwrap } from "../hooks/useCoral";

// ── Source icon map ────────────────────────────────────────────────────────
function SourceIcon({ source }) {
  const cls = "shrink-0";
  if (source === "github")
    return (
      <span className={`${cls} text-[#58a6ff]`} title="GitHub">
        <GitBranch size={14} />
      </span>
    );
  if (source === "slack")
    return (
      <span className={`${cls} text-[#e879f9]`} title="Slack">
        <Hash size={14} />
      </span>
    );
    if (source === "notion")
    return (
      <span className={`${cls} text-text-primary`} title="Notion">
        <FileText size={14} />
      </span>
    );
  return (
    <span className={`${cls} text-[#475569]`}>
      <FileText size={14} />
    </span>
  );
}

// ── Time-since helper ──────────────────────────────────────────────────────
function timeSince(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor(diff / 3_600_000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return "just now";
}

// ── Loop Card ──────────────────────────────────────────────────────────────
function LoopCard({ item }) {
  return (
    <div className="group card p-4 hover:border-[#f59e0b44] hover:glow-amber transition-all duration-200 fade-in">
      <div className="flex items-start gap-3">
        <SourceIcon source={item.source} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="text-[13px] font-medium text-text-primary leading-snug truncate">
              {item.item}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span className="badge bg-[#f59e0b15] text-[#f59e0b] border border-[#f59e0b28]">
                {item.touches}× touched
              </span>
            </div>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
            {item.description}
          </p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-text-secondary">
              Last visited: {" "}
              <span className="text-text-secondary">{timeSince(item.last_touched)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 fade-in">
      <CheckCircle size={32} className="text-[#10b981]" />
      <p className="text-[14px] font-medium text-[#10b981]">
        No attention sinkholes detected.
      </p>
      <p className="text-[12px] text-[#475569]">You're shipping. 🚀</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function UnfinishedLoops() {
  const { data, loading, error, failedSources, timedOutSources, refetch } = useCoral("/api/unfinished-loops");

  useEffect(() => {
    refetch();
  }, []);

  const loops = unwrap(data?.loops);

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary flex items-center gap-2">
            <span className="text-[#f59e0b]">⟳</span>
            Unfinished Loops
            <div className="flex gap-1.5 ml-2">
              <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes('notion') ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} title="Notion" />
              <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes('github') ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} title="GitHub" />
            </div>
          </h2>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Work repeatedly touched but never closed — your attention sinkholes
          </p>
        </div>
          <button
          id="loops-refresh-btn"
          onClick={() => refetch()}
          disabled={loading}
          className="p-2 rounded-lg bg-[#0f0f1a] border border-[#1e1e32] text-text-secondary hover:text-accent hover:border-accent/20 transition-all disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stats bar */}
      {!loading && loops.length > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-[#f59e0b08] border border-[#f59e0b20]">
          <div className="font-mono text-[24px] font-bold text-[#f59e0b]">
            {loops.length}
          </div>
          <div className="text-[12px] text-text-secondary">
            open loops detected across{" "}
            <span className="text-[#f59e0b]">
              {[...new Set(loops.map((l) => l.source))].join(", ")}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-[12px] text-red-600">
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
      
      {timedOutSources?.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-[12px] text-amber-600">
          <AlertTriangle size={13} />
          Some sources timed out: {timedOutSources.join(', ')}
        </div>
      )}

      {/* Content */}
      {loading && !data ? (
        <Skeleton />
      ) : !data && !error ? (
        <div className="p-4 text-center text-[13px] text-text-secondary fade-in">
          No data available.
        </div>
      ) : loops.length === 0 ? (
        failedSources?.length > 0 ? (
          <p className="text-[13px] text-text-secondary text-center py-8 fade-in">
            No data from {failedSources.join(', ')}
          </p>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="space-y-3">
          {loops.map((loop, i) => (
            <LoopCard key={i} item={loop} />
          ))}
        </div>
      )}
    </div>
  );
}
