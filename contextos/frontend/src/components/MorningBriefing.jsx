import { useEffect, useRef } from "react";
import { RefreshCw, AlertTriangle, Clock, Zap, Coffee } from "lucide-react";
import { useCoral, unwrap } from "../hooks/useCoral";

// ── Source badge ───────────────────────────────────────────────────────────
const SOURCE_COLORS = {
  github:   { bg: "bg-[#21262d]",  text: "text-[#58a6ff]", label: "GitHub" },
  slack:    { bg: "bg-[#3f1f4e]",  text: "text-[#e879f9]", label: "Slack" },
  discord:  { bg: "bg-[#1e1b4b]",  text: "text-[#818cf8]", label: "Discord" },
  notion:   { bg: "bg-[#1a1a1a]",  text: "text-[#e2e8f0]", label: "Notion" },
  calendar: { bg: "bg-[#1a2e1a]",  text: "text-[#10b981]", label: "Calendar" },
  default:  { bg: "bg-[#1e1e32]",  text: "text-[#94a3b8]", label: "" },
};

function SourceBadge({ source, failed }) {
  const s = SOURCE_COLORS[source] || SOURCE_COLORS.default;
  return (
    <span className={`badge ${s.bg} ${s.text} flex items-center gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${failed ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} />
      {s.label || source}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function BriefingSkeleton() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-4 w-1/2" />
      <div className="h-px bg-[#1e1e32] my-4" />
      {[1, 2].map((i) => (
        <div key={i} className="skeleton h-16 w-full rounded-lg" />
      ))}
      <div className="skeleton h-10 w-full rounded-lg mt-2" />
      <div className="skeleton h-14 w-full rounded-lg" />
    </div>
  );
}

// ── Calendar mini-event ────────────────────────────────────────────────────
function CalendarEvent({ event }) {
  const rawStart = event.start_date_time || event.start_date || event.start;
  const rawEnd = event.end_date_time || event.end_date || event.end;
  const start = new Date(typeof rawStart === 'string' ? rawStart.replace(/Z$/, '') : rawStart);
  const end = new Date(typeof rawEnd === 'string' ? rawEnd.replace(/Z$/, '') : rawEnd);
  const fmt = (d) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#1e1e3240] last:border-0">
      <div className="flex flex-col items-center min-w-[46px] font-mono text-[10px] text-[#00d4ff] leading-tight">
        <span>{fmt(start)}</span>
        <span className="text-[#475569]">{fmt(end)}</span>
      </div>
      <span className="text-[13px] text-[#94a3b8] leading-tight pt-0.5">{event.summary}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MorningBriefing() {
  const { data, loading, error, failedSources, timedOutSources, refetch } = useCoral("/api/briefing");

  useEffect(() => {
    refetch();
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const briefing = data?.briefing;
  const calendarEvents = unwrap(data?.sources?.calendar).slice(0, 3);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <Coffee size={14} className="text-[#00d4ff]" />
            <span className="text-[11px] font-mono text-[#475569] uppercase tracking-widest">
              {greeting}
            </span>
          </div>
          <div className="font-mono text-[22px] font-semibold text-[#e2e8f0] leading-tight mt-0.5">
            {timeStr}
          </div>
        </div>
        <button
          id="briefing-refresh-btn"
          onClick={() => refetch()}
          disabled={loading}
          className="p-2 rounded-lg bg-[#0f0f1a] border border-[#1e1e32] text-[#475569] hover:text-[#00d4ff] hover:border-[#00d4ff33] transition-all disabled:opacity-40"
          title="Refresh briefing"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="h-px bg-[#1e1e32] mx-4 my-1" />

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-[#ef444412] border border-[#ef444433] flex items-center gap-2 text-[12px] text-[#ef4444]">
          <AlertTriangle size={13} />
          {error}
        </div>
      )}
      
      {timedOutSources?.length > 0 && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-[#f59e0b12] border border-[#f59e0b33] flex items-center gap-2 text-[12px] text-[#f59e0b]">
          <Clock size={13} />
          Some sources timed out: {timedOutSources.join(', ')}
        </div>
      )}

      {/* Loading */}
      {loading && !data && <BriefingSkeleton />}
      
      {/* Empty State */}
      {!loading && !data && !error && (
        <div className="p-4 text-center text-[13px] text-[#475569] fade-in">
          No briefing available yet.
        </div>
      )}

      {/* Content */}
      {briefing && (
        <div className="flex flex-col gap-3 p-4 fade-in">
          {/* URGENT */}
          {briefing.urgent?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={11} className="text-[#ef4444]" />
                <span className="text-[10px] font-mono font-bold text-[#ef4444] tracking-widest uppercase">
                  Urgent
                </span>
              </div>
              <div className="space-y-2">
                {briefing.urgent.map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[#ef444408] border border-[#ef444430] hover:border-[#ef444455] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[12px] text-[#e2e8f0] leading-snug">{item.item}</span>
                      <SourceBadge source={item.source} failed={failedSources?.includes(item.source)} />
                    </div>
                    <p className="text-[11px] text-[#475569] leading-relaxed">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WAITING ON YOU */}
          {briefing.waiting_on_you?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={11} className="text-[#f59e0b]" />
                <span className="text-[10px] font-mono font-bold text-[#f59e0b] tracking-widest uppercase">
                  Waiting on you
                </span>
              </div>
              <div className="space-y-2">
                {briefing.waiting_on_you.map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[#f59e0b08] border border-[#f59e0b28] hover:border-[#f59e0b50] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[12px] text-[#e2e8f0] leading-snug">{item.item}</span>
                      <SourceBadge source={item.source} failed={failedSources?.includes(item.source)} />
                    </div>
                    <span className="font-mono text-[10px] text-[#f59e0b]">
                      {item.age_hours}h ago
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BEST FOCUS WINDOW */}
          {briefing.best_focus_window && (
            <div className="p-3 rounded-lg bg-[#00d4ff0a] border border-[#00d4ff28] glow-cyan">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={11} className="text-[#00d4ff]" />
                <span className="text-[10px] font-mono font-bold text-[#00d4ff] tracking-widest uppercase">
                  Best Focus Window
                </span>
              </div>
              <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                {briefing.best_focus_window}
              </p>
            </div>
          )}

          {/* SUMMARY */}
          {briefing.summary && (
            <p className="text-[12px] text-[#475569] leading-relaxed px-1">
              {briefing.summary}
            </p>
          )}
        </div>
      )}

      {/* Calendar Events */}
      <div className="mt-auto px-4 pb-4">
        <div className="h-px bg-[#1e1e32] mb-3" />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-[#475569] uppercase tracking-widest">
            Today's Schedule
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes('calendar') ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} />
        </div>
        <div className="card p-1">
          {calendarEvents.length > 0 ? (
            calendarEvents.map((ev, i) => (
              <CalendarEvent key={i} event={ev} />
            ))
          ) : (
            <p className="text-[11px] text-[#475569] p-3 text-center">No data from calendar</p>
          )}
        </div>
      </div>
    </div>
  );
}
