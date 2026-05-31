import { useEffect, useRef, useState } from "react";
import {
  RefreshCw, AlertTriangle, Clock, Zap, Coffee, CheckSquare,
  ShieldAlert, Eye, MessageSquare, Send, X, Sparkles, ChevronRight,
} from "lucide-react";
import { useCoral, useChat, unwrap } from "../hooks/useCoral";

// ── Source badge colors ────────────────────────────────────────────────────
const SOURCE_COLORS = {
  github:   { bg: "bg-[#21262d]",  text: "text-[#58a6ff]", label: "GitHub" },
  slack:    { bg: "bg-[#3f1f4e]",  text: "text-[#e879f9]", label: "Slack" },
  discord:  { bg: "bg-[#1e1b4b]",  text: "text-[#818cf8]", label: "Discord" },
  notion:   { bg: "bg-[#1a1a1a]",  text: "text-[#e2e8f0]", label: "Notion" },
  calendar: { bg: "bg-[#1a2e1a]",  text: "text-[#10b981]", label: "Calendar" },
  default:  { bg: "bg-[#1e1e32]",  text: "text-[#94a3b8]", label: "" },
};

// Signal type → accent colour mapping
const SIGNAL_COLORS = {
  MEETING_SOON:      { border: "#0b5f53", text: "#0b5f53", bg: "#0b5f5315", dot: "#0b5f53" },
  BACK_TO_BACK:      { border: "#f59e0b", text: "#f59e0b", bg: "#f59e0b0d", dot: "#f59e0b" },
  MEETING_NO_AGENDA: { border: "#818cf8", text: "#818cf8", bg: "#818cf80d", dot: "#818cf8" },
  IMPORTANT_UNREAD:  { border: "#ef4444", text: "#ef4444", bg: "#ef44440d", dot: "#ef4444" },
  OVERDUE_TASK:      { border: "#f59e0b", text: "#f59e0b", bg: "#f59e0b0d", dot: "#f59e0b" },
  STALE_PAGE:        { border: "#475569", text: "#94a3b8", bg: "#47556910", dot: "#475569" },
  OLD_PR:            { border: "#58a6ff", text: "#58a6ff", bg: "#58a6ff0d", dot: "#58a6ff" },
  UNREAD_MENTION:    { border: "#e879f9", text: "#e879f9", bg: "#e879f90d", dot: "#e879f9" },
};

// ── Sub-components ──────────────────────────────────────────────────────────

// Removed BriefingSkeleton to render layout immediately and use inline skeletons

function ClearLine() {
  return <p className="text-[11px] text-text-secondary italic px-1">Clear.</p>;
}

function SituationCard({ text, loading }) {
  if (loading) {
    return (
      <div className="w-full px-4 pt-4 pb-2 fade-in">
        <div style={{ height: '1.2em', width: '80%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }
  if (!text || text === "Clear.") return <ClearLine />;
  return (
    <div className="w-full px-4 pt-4 pb-2 fade-in">
      <p className="text-[15px] font-medium text-text-primary leading-snug tracking-tight">
        {text}
      </p>
    </div>
  );
}

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
            <span className="text-[12px] text-text-secondary leading-snug group-hover:text-text-primary transition-colors">
              {action}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
            <span className="text-[12px] text-text-secondary leading-snug">{risk}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FocusWindowCard({ text, loading }) {
  if (loading) {
    return (
      <div className="mx-4 p-3 rounded-lg bg-[#00d4ff0a] border border-[#00d4ff28] glow-cyan fade-in">
        <div className="flex items-center gap-2 mb-1.5">
        <Zap size={11} className="text-text-primary" />
        <span className="text-[10px] font-mono font-bold text-text-primary tracking-widest uppercase">Best Focus Window</span>
        </div>
        <div style={{ height: '1.2em', width: '60%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }
  if (!text || text === "Clear.") return <ClearLine />;
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
        <div className="font-mono text-[16px] font-semibold text-text-primary mb-1">{timeBlock}</div>
      )}
      <p className="text-[12px] text-text-secondary leading-relaxed">{rest || text}</p>
    </div>
  );
}

function OneThingCard({ text, loading }) {
  if (loading) {
    return (
      <div className="mx-4 p-3 rounded-lg bg-[#10b9810a] border border-[#10b98128] fade-in">
        <div className="flex items-center gap-2 mb-1">
          <Eye size={11} className="text-[#10b981]" />
          <span className="text-[10px] font-mono font-bold text-[#10b981] tracking-widest uppercase">One Thing</span>
        </div>
        <div style={{ height: '1.2em', width: '70%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }
  if (!text || text === "Clear.") return null;
  return (
    <div className="mx-4 p-3 rounded-lg bg-[#10b9810a] border border-[#10b98128] fade-in">
      <div className="flex items-center gap-2 mb-1">
        <Eye size={11} className="text-[#10b981]" />
        <span className="text-[10px] font-mono font-bold text-[#10b981] tracking-widest uppercase">
          One Thing
        </span>
      </div>
      <p className="text-[13px] font-semibold text-text-primary leading-snug">{text}</p>
    </div>
  );
}

function CalendarEvent({ event }) {
  const rawStart = event.start_date_time || event.start_date || event.start;
  const rawEnd   = event.end_date_time   || event.end_date   || event.end;
  const start = new Date(typeof rawStart === "string" ? rawStart.replace(/Z$/, "") : rawStart);
  const end   = new Date(typeof rawEnd   === "string" ? rawEnd.replace(/Z$/, "")   : rawEnd);
  const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#1e1e3240] last:border-0">
      <div className="flex flex-col items-center min-w-[46px] font-mono text-[10px] text-text-primary leading-tight">
        <span>{fmt(start)}</span>
        <span className="text-text-secondary">{fmt(end)}</span>
      </div>
      <span className="text-[13px] text-text-secondary leading-tight pt-0.5">{event.summary}</span>
    </div>
  );
}

// ── Signal chip ─────────────────────────────────────────────────────────────
function SignalChip({ signal, onTap, active }) {
  const c = SIGNAL_COLORS[signal.type] || SIGNAL_COLORS.STALE_PAGE;
  return (
    <button
      onClick={() => onTap(signal)}
      style={{
        borderColor: active ? c.border : "#1e1e32",
        background:  active ? c.bg     : "transparent",
        color:       active ? c.text   : "#475569",
      }}
      className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[11px] leading-snug transition-all hover:opacity-90 active:scale-[0.98]"
    >
      <span
        className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: c.dot }}
      />
      <span className="flex-1">{signal.label}</span>
      <ChevronRight size={10} className="shrink-0 mt-0.5 opacity-50" />
    </button>
  );
}

// ── Chat panel ──────────────────────────────────────────────────────────────
function ChatPanel({ initialSignal, onClose }) {
  const { history, loading, error, sendMessage, reset } = useChat();
  const [input, setInput]           = useState("");
  const [initSent, setInitSent]     = useState(false);
  const bottomRef                   = useRef(null);

  // Send the signal's label as the opening message once on mount
  useEffect(() => {
    if (initialSignal && !initSent) {
      setInitSent(true);
      sendMessage(initialSignal.label, initialSignal.context);
    }
  }, [initialSignal, initSent, sendMessage]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    sendMessage(trimmed, {});
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-4 mb-4 rounded-xl border border-[#1e1e32] bg-[#0a0a14] flex flex-col overflow-hidden fade-in" style={{ maxHeight: 380 }}>
      {/* Chat header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e32] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={11} className="text-[#00d4ff]" />
          <span className="text-[11px] font-mono font-bold text-[#00d4ff] uppercase tracking-widest">
            Chief of Staff
          </span>
        </div>
        <button
          onClick={() => { reset(); onClose(); }}
          className="text-[#475569] hover:text-[#e2e8f0] transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {history.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#00d4ff18] border border-[#00d4ff28] text-[#e2e8f0] rounded-br-sm"
                  : "bg-[#151524] border border-[#1e1e32] text-[#94a3b8] rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#151524] border border-[#1e1e32] px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-[#475569]"
                  style={{ animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-[11px] text-[#ef4444] px-1">
            <AlertTriangle size={11} />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-[#1e1e32]">
        <textarea
          id="chat-input"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Follow up…"
          className="flex-1 bg-transparent border-none outline-none resize-none text-[12px] font-mono text-[#e2e8f0] placeholder-[#2d3748] leading-relaxed"
          style={{ maxHeight: 72 }}
        />
        <button
          id="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="shrink-0 p-1.5 rounded-lg transition-all disabled:opacity-30"
          style={{ background: input.trim() && !loading ? "#00d4ff" : "#1e1e32" }}
        >
          <Send size={11} style={{ color: input.trim() && !loading ? "#0a0a0f" : "#475569" }} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MorningBriefing() {
  const { data, loading, error, failedSources, timedOutSources, refetch } =
    useCoral("/api/briefing");

  const [activeSignal, setActiveSignal] = useState(null);
  const [chatOpen,     setChatOpen]     = useState(false);

  useEffect(() => { refetch(); }, []);

  const [timeState, setTimeState] = useState(() => {
    const now = new Date();
    return {
      hour: now.getHours(),
      timeStr: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimeState({
        hour: now.getHours(),
        timeStr: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const greeting = timeState.hour < 12 ? "Good morning" : timeState.hour < 17 ? "Good afternoon" : "Good evening";
  const timeStr  = timeState.timeStr;

  const briefing       = data?.briefing;
  const signals        = data?.signals || [];
  const calendarEvents = unwrap(data?.sources?.calendar).slice(0, 3);

  const handleSignalTap = (signal) => {
    if (activeSignal?.type === signal.type && chatOpen) {
      // Tap same chip again → close
      setChatOpen(false);
      setActiveSignal(null);
    } else {
      setActiveSignal(signal);
      setChatOpen(true);
    }
  };

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
          onClick={() => { setChatOpen(false); setActiveSignal(null); refetch(); }}
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

      {/* Loading (removed blocking skeleton) */}

      {/* Empty */}
      {!loading && !data && !error && (
        <div className="p-4 text-center text-[13px] text-[#475569] fade-in">
          No briefing available yet.
        </div>
      )}

      {/* 5-Section Briefing */}
      {(loading || briefing) && (
        <div className="flex flex-col gap-3 pb-3 fade-in">
          <SituationCard    text={briefing?.situation} loading={loading && !data} />
          <div className="h-px bg-[#1e1e32] mx-4" />
          {!loading && briefing?.beforeYouStart && <BeforeYouStartCard items={briefing.beforeYouStart} />}
          {!loading && briefing?.watchOut && <WatchOutCard items={briefing.watchOut} />}
          <FocusWindowCard    text={briefing?.bestFocusWindow} loading={loading && !data} />
          <OneThingCard       text={briefing?.oneThing} loading={loading && !data} />
        </div>
      )}

      {/* ── Signals ──────────────────────────────────────────────────── */}
      {signals.length > 0 && (
        <div className="mx-4 mb-3 fade-in">
          <div className="h-px bg-[#1e1e32] mb-3" />
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={11} className="text-[#00d4ff]" />
            <span className="text-[10px] font-mono font-bold text-[#475569] uppercase tracking-widest">
              Want to act on something?
            </span>
          </div>
          <div className="space-y-1.5">
            {signals.map((sig) => (
              <SignalChip
                key={sig.type}
                signal={sig}
                onTap={handleSignalTap}
                active={activeSignal?.type === sig.type && chatOpen}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Chat panel (inline, below signals) ───────────────────────── */}
      {chatOpen && activeSignal && (
        <ChatPanel
          key={activeSignal.type}
          initialSignal={activeSignal}
          onClose={() => { setChatOpen(false); setActiveSignal(null); }}
        />
      )}

      {/* Calendar Events — pinned to bottom */}
      <div className="mt-auto px-4 pb-4">
        <div className="h-px bg-[#1e1e32] mb-3" />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-[#475569] uppercase tracking-widest">
            Today's Schedule
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${failedSources?.includes("calendar") ? "bg-[#ef4444]" : "bg-[#10b981]"}`} />
        </div>
        <div className="card p-1">
          {loading && !data ? (
            <div className="p-3 space-y-3">
              <div style={{ height: '1.2em', width: '90%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: '1.2em', width: '75%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ) : calendarEvents.length > 0 ? (
            calendarEvents.map((ev, i) => <CalendarEvent key={i} event={ev} />)
          ) : (
            <p className="text-[11px] text-[#475569] p-3 text-center">No data from calendar</p>
          )}
        </div>
      </div>
    </div>
  );
}
