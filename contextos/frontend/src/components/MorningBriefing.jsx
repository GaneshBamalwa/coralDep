import { useEffect } from "react";
import { RefreshCw, AlertTriangle, Clock, Zap, Coffee, CheckSquare, ShieldAlert, Eye } from "lucide-react";
import { useCoral, unwrap } from "../hooks/useCoral";

// Source badge colors
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
      <span className={`w-1.5 h-1.5 rounded-full ${failed ? "bg-[#ef4444]" : "bg-[#10b981]"}`} />
      {s.label || source}
    </span>
  );
}

function BriefingSkeleton() {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="skeleton h-24 w-full rounded-lg" />
      <div className="skeleton h-20 w-full rounded-lg" />
      <div className="skeleton h-16 w-full rounded-lg" />
      <div className="skeleton h-12 w-full rounded-lg" />
    </div>
  );
}

function ClearLine() {
  return <p className="text-[11px] text-[#2d3748] italic px-1">Clear.</p>;
}

// SITUATION — full-width banner
function SituationCard({ text }) {
  if (!text || text === "Clear.") return <ClearLine />;
  return (
    <div className="w-full px-4 pt-4 pb-2 fade-in">
      <p className="text-[15px] font-medium text-[#e2e8f0] leading-snug tracking-tight">
        {text}
      </p>
    </div>
  );
}

// BEFORE YOU START — checklist
function BeforeYouStartCard({ items }) {
  if (!items || items.length === 0) return <ClearLine />;
  if (items === "Clear." || (Array.isArray(items) && items[0] === "Clear.")) return <ClearLine />;
  const list = Array.isArray(items) ? items : [items];
  return (
    <div className="mx-4 p-3 rounded-lg bg-[#0f1a2e] border border-[#1e3a5f40] fade-in">
      <div className="flex items-center gap-2 mb-2">
        <CheckSquare size={11} className="text-[#3b82f6]" />
        <span className="text-[10px] font-mono font-bold text-[#3b82f6] tracking-widest uppercase">
          Before You Start
        </span>
      </div>
      <ul className="space-y-2">
        {list.map((action, i) => (
          <li key={i} className="flex items-start gap-2 group cursor-pointer">
            <span className="mt-0.5 w-4 h-4 rounded border border-[#3b82f640] flex-shrink-0 group-hover:border-[#3b82f6] transition-colors" />
            <span className="text-[12px] text-[#94a3b8] leading-snug group-hover:text-[#e2e8f0] transition-colors">
              {action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// WATCH OUT — amber risk card
function WatchOutCard({ items }) {
  if (!items || items.length === 0) return null;
  if (items === "Clear." || (Array.isArray(items) && items[0] === "Clear.")) return null;
  const list = Array.isArray(items) ? items : [items];
  return (
    <div className="mx-4 p-3 rounded-lg bg-[#f59e0b08] border-l-2 border-l-[#f59e0b] border border-[#f59e0b20] fade-in">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert size={11} className="text-[#f59e0b]" />
        <span className="text-[10px] font-mono font-bold text-[#f59e0b] tracking-widest uppercase">
          Watch Out
        </span>
      </div>
      <ul className="space-y-1.5">
        {list.map((risk, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-[#f59e0b] flex-shrink-0" />
            <span className="text-[12px] text-[#94a3b8] leading-snug">{risk}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// BEST FOCUS WINDOW — prominent time block
function FocusWindowCard({ text }) {
  if (!text || text === "Clear.") return <ClearLine />;
  // Try to extract a time range from the text for prominent display
  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/i);
  const timeBlock = timeMatch?.[1] || null;
  const rest = timeBlock ? text.replace(timeBlock, "").replace(/^[:\s,–-]+/, "").trim() : text;

  return (
    <div className="mx-4 p-3 rounded-lg bg-[#00d4ff0a] border border-[#00d4ff28] glow-cyan fade-in">
      <div className="flex items-center gap-2 mb-1.5">
        <Zap size={11} className="text-[#00d4ff]" />
        <span className="text-[10px] font-mono font-bold text-[#00d4ff] tracking-widest uppercase">
          Best Focus Window
        </span>
      </div>
      {timeBlock && (
        <div className="font-mono text-[16px] font-semibold text-[#00d4ff] mb-1">{timeBlock}</div>
      )}
      <p className="text-[12px] text-[#94a3b8] leading-relaxed">{rest || text}</p>
    </div>
  );
}

// ONE THING — bold full-width card
function OneThingCard({ text }) {
  if (!text || text === "Clear.") return null;
  return (
    <div className="mx-4 p-3 rounded-lg bg-[#10b9810a] border border-[#10b98128] fade-in">
      <div className="flex items-center gap-2 mb-1">
        <Eye size={11} className="text-[#10b981]" />
        <span className="text-[10px] font-mono font-bold text-[#10b981] tracking-widest uppercase">
          One Thing
        </span>
      </div>
      <p className="text-[13px] font-semibold text-[#e2e8f0] leading-snug">{text}</p>
    </div>
  );
}

// Calendar mini-event
function CalendarEvent({ event }) {
  const rawStart = event.start_date_time || event.start_date || event.start;
  const rawEnd   = event.end_date_time   || event.end_date   || event.end;
  const start = new Date(typeof rawStart === "string" ? rawStart.replace(/Z$/, "") : rawStart);
  const end   = new Date(typeof rawEnd   === "string" ? rawEnd.replace(/Z$/, "")   : rawEnd);
  const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

// Main component
export default function MorningBriefing() {
  const { data, loading, error, failedSources, timedOutSources, refetch } = useCoral("/api/briefing");

  useEffect(() => { refetch(); }, []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

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

      {/* Errors */}
      {error && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-[#ef444412] border border-[#ef444433] flex items-center gap-2 text-[12px] text-[#ef4444]">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      {timedOutSources?.length > 0 && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-[#f59e0b12] border border-[#f59e0b33] flex items-center gap-2 text-[12px] text-[#f59e0b]">
          <Clock size={13} /> Some sources timed out: {timedOutSources.join(", ")}
        </div>
      )}

      {/* Loading */}
      {loading && !data && <BriefingSkeleton />}

      {/* Empty */}
      {!loading && !data && !error && (
        <div className="p-4 text-center text-[13px] text-[#475569] fade-in">
          No briefing available yet.
        </div>
      )}

      {/* 5-Section Briefing */}
      {briefing && (
        <div className="flex flex-col gap-3 pb-3 fade-in">
          {/* SITUATION */}
          <SituationCard text={briefing.situation} />

          <div className="h-px bg-[#1e1e32] mx-4" />

          {/* BEFORE YOU START */}
          <BeforeYouStartCard items={briefing.beforeYouStart} />

          {/* WATCH OUT */}
          <WatchOutCard items={briefing.watchOut} />

          {/* BEST FOCUS WINDOW */}
          <FocusWindowCard text={briefing.bestFocusWindow} />

          {/* ONE THING */}
          <OneThingCard text={briefing.oneThing} />
        </div>
      )}

      {/* Calendar Events */}
      <div className="mt-auto px-4 pb-4">
        <div className="h-px bg-[#1e1e32] mb-3" />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-[#475569] uppercase tracking-widest">
            Today's Schedule
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes("calendar") ? "bg-[#ef4444]" : "bg-[#10b981]"}`} />
        </div>
        <div className="card p-1">
          {calendarEvents.length > 0 ? (
            calendarEvents.map((ev, i) => <CalendarEvent key={i} event={ev} />)
          ) : (
            <p className="text-[11px] text-[#475569] p-3 text-center">No data from calendar</p>
          )}
        </div>
      </div>
    </div>
  );
}
