import { useEffect, useState } from "react";
import { Calendar, GitPullRequest, MessageSquare, FileText, MessageCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { useCoral, unwrap } from "../hooks/useCoral";

// ── Source config ──────────────────────────────────────────────────────────
const SOURCE_META = {
  calendar: { icon: Calendar,        color: "#10b981", label: "Calendar" },
  github:   { icon: GitPullRequest,  color: "#58a6ff", label: "GitHub" },
  slack:    { icon: MessageSquare,   color: "#e879f9", label: "Slack" },
  notion:   { icon: FileText,        color: "#e2e8f0", label: "Notion" },
  discord:  { icon: MessageCircle,   color: "#818cf8", label: "Discord" },
};

// ── Time helper ────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today - d) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Build unified timeline from briefing sources ───────────────────────────
function buildTimeline(sources) {
  const events = [];

  (sources?.calendar || []).forEach((e) =>
    events.push({ type: "calendar", title: e.summary, ts: e.start, subtitle: `${fmtTime(e.start)} – ${fmtTime(e.end)}` })
  );
  (sources?.github || []).forEach((e) =>
    events.push({ type: "github", title: `PR #${e.number}: ${e.title}`, ts: e.updated_at, subtitle: e.state })
  );
  (sources?.slack || []).forEach((e) =>
    events.push({ type: "slack", title: e.text?.slice(0, 80) + (e.text?.length > 80 ? "…" : ""), ts: e.ts, subtitle: e.channel })
  );
  (sources?.notion || []).forEach((e) =>
    events.push({ type: "notion", title: e.title, ts: e.due_date, subtitle: `Due · ${e.status}` })
  );
  (sources?.discord || []).forEach((e) =>
    events.push({ type: "discord", title: e.content?.slice(0, 80) + (e.content?.length > 80 ? "…" : ""), ts: e.timestamp, subtitle: `@${e.author_username}` })
  );

  return events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

// ── Timeline Event Item ────────────────────────────────────────────────────
function TimelineEvent({ event, isFirst, showDate }) {
  const meta = SOURCE_META[event.type] || SOURCE_META.calendar;
  const Icon = meta.icon;

  return (
    <div className="flex gap-4 fade-in group">
      {/* Spine */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all group-hover:scale-110"
          style={{ background: `${meta.color}15`, borderColor: `${meta.color}30`, color: meta.color }}
        >
          <Icon size={13} />
        </div>
        {!isFirst && <div className="w-px flex-1 bg-bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-5 min-w-0">
        {showDate && (
          <div className="font-mono text-[9px] text-text-secondary uppercase tracking-widest mb-1.5">
            {fmtDate(event.ts)}
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] text-text-primary leading-snug">{event.title}</p>
          <span className="font-mono text-[10px] text-text-secondary shrink-0 mt-0.5">
            {fmtTime(event.ts) || fmtDate(event.ts)}
          </span>
        </div>
        {event.subtitle && (
          <span
            className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: `${meta.color}12`, color: meta.color }}
          >
            {event.subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-6 p-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Filter Chip ────────────────────────────────────────────────────────────
function FilterChip({ label, color, active, onClick, failed }) {
  return (
    <button
      onClick={onClick}
      className="badge cursor-pointer transition-all flex items-center gap-1.5"
      style={{
        background: active ? `${color}22` : "var(--surface-01)",
        color: active ? color : "var(--muted)",
        border: active ? `1px solid ${color}55` : '1px solid var(--border-ghost)',
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${failed ? 'bg-red-500' : 'bg-accent'}`} />
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ContextTimeline() {
  const { data, loading, error, failedSources, timedOutSources, refetch } = useCoral("/api/briefing");
  const [activeFilters, setActiveFilters] = useState(Object.keys(SOURCE_META));

  useEffect(() => { refetch(); }, []);

  // Unwrap .rows from each source
  const rawSources = data?.sources || {};
  const unwrapped = Object.fromEntries(
    Object.entries(rawSources).map(([k, v]) => [k, unwrap(v)])
  );
  const allEvents = buildTimeline(unwrapped);
  const filtered = allEvents.filter((e) => activeFilters.includes(e.type));

  const toggleFilter = (type) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((f) => f !== type) : [...prev, type]
    );
  };

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary">Context Timeline</h2>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Unified activity stream across all connected sources
          </p>
        </div>
        <button
          id="timeline-refresh-btn"
          onClick={() => refetch()}
          disabled={loading}
          className="p-2 rounded-lg bg-bg-surface border border-bg-border text-text-secondary hover:text-accent hover:border-accent/20 transition-all disabled:opacity-40"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SOURCE_META).map(([type, meta]) => (
          <FilterChip
            key={type}
            label={meta.label}
            color={meta.color}
            active={activeFilters.includes(type)}
            onClick={() => toggleFilter(type)}
            failed={failedSources?.includes(type)}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-[12px] text-red-600">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      
      {timedOutSources?.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-[12px] text-amber-600">
          <AlertTriangle size={13} /> Some sources timed out: {timedOutSources.join(', ')}
        </div>
      )}

      {/* Timeline */}
      {loading && !data ? (
        <Skeleton />
      ) : !data && !error ? (
        <div className="p-4 text-center text-[13px] text-text-secondary fade-in">
          No timeline data available.
        </div>
      ) : (
        <div className="card p-5">
          {filtered.length === 0 ? (
            <p className="text-[13px] text-text-secondary text-center py-8">
              {activeFilters.length > 0 ? `No data from ${activeFilters.map(f => SOURCE_META[f]?.label).join(', ')}` : 'No events to show'}
            </p>
          ) : (
            <div className="flex flex-col">
              {filtered.map((event, i) => {
                const prevEvent = filtered[i - 1];
                const showDate = !prevEvent || fmtDate(event.ts) !== fmtDate(prevEvent.ts);
                return (
                  <TimelineEvent
                    key={i}
                    event={event}
                    isFirst={i === 0}
                    showDate={showDate}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
