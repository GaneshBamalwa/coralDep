import { useEffect } from "react";
import {
  Calendar, Github, Slack, FileText, MessageCircle,
} from "lucide-react";
import { useCoral } from "../hooks/useCoral";

// ── Source display config ──────────────────────────────────────────────────
const SOURCE_META = {
  google_calendar: { label: "Calendar",  Icon: Calendar,       color: "#10b981" },
  github:          { label: "GitHub",    Icon: Github,         color: "#58a6ff" },
  slack:           { label: "Slack",     Icon: Slack,          color: "#e879f9" },
  notion:          { label: "Notion",    Icon: FileText,       color: "#e2e8f0" },
  discord:         { label: "Discord",   Icon: MessageCircle,  color: "#818cf8" },
};

// ── Dot ───────────────────────────────────────────────────────────────────
function StatusDot({ connected }) {
  if (connected === true)
    return (
      <span
        className="dot-pulse w-[7px] h-[7px] rounded-full"
        style={{ background: "#10b981", boxShadow: "0 0 6px #10b98166" }}
      />
    );
  if (connected === false)
    return (
      <span
        className="w-[7px] h-[7px] rounded-full inline-block"
        style={{ background: "#ef4444", boxShadow: "0 0 6px #ef444466" }}
      />
    );
  return (
    <span
      className="w-[7px] h-[7px] rounded-full inline-block"
      style={{ background: "#475569" }}
    />
  );
}

// ── Source Row ─────────────────────────────────────────────────────────────
function SourceRow({ name, connected, rows_cached }) {
  const meta = SOURCE_META[name] || {
    label: name,
    Icon: FileText,
    color: "#475569",
  };
  const { label, Icon, color } = meta;

  return (
    <div className="flex items-center gap-2.5 py-1.5 group">
      <StatusDot connected={connected} />
      <Icon size={12} style={{ color }} className="shrink-0" />
      <span className="text-[12px] text-[#94a3b8] flex-1 leading-none">
        {label}
      </span>
      {rows_cached != null && rows_cached > 0 && (
        <span className="font-mono text-[9px] text-[#475569]">
          {rows_cached.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-2 px-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton h-5 w-full rounded" />
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SourceStatus() {
  const { data, loading, refetch } = useCoral("/api/sources");

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  const sources = Array.isArray(data) ? data : [];
  const connectedCount = sources.filter((s) => s.connected).length;

  return (
    <div className="px-2">
      {/* Section label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono text-[#475569] uppercase tracking-widest">
          Sources
        </span>
        {!loading && sources.length > 0 && (
          <span className="font-mono text-[9px] text-[#10b981]">
            {connectedCount}/{sources.length}
          </span>
        )}
      </div>

      {loading && sources.length === 0 ? (
        <Skeleton />
      ) : sources.length === 0 ? (
        /* Fallback: show known sources as unknown */
        <div className="space-y-0.5">
          {Object.keys(SOURCE_META).map((name) => (
            <SourceRow key={name} name={name} connected={null} rows_cached={null} />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {sources.map((src) => (
            <SourceRow
              key={src.name}
              name={src.name}
              connected={src.connected}
              rows_cached={src.rows_cached}
            />
          ))}
        </div>
      )}
    </div>
  );
}
