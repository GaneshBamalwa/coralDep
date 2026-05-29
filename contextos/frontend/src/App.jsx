import { useState } from "react";
import {
  Sun, GitBranch, RefreshCcw, AlignLeft, Terminal, Cpu,
} from "lucide-react";

import MorningBriefing  from "./components/MorningBriefing";
import FocusDebt        from "./components/FocusDebt";
import UnfinishedLoops  from "./components/UnfinishedLoops";
import ContextTimeline  from "./components/ContextTimeline";
import QueryConsole     from "./components/QueryConsole";
import SourceStatus     from "./components/SourceStatus";
import { ErrorBoundary }  from "./components/ErrorBoundary";

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "briefing",  label: "Briefing",  icon: Sun },
  { id: "today",     label: "Focus",     icon: RefreshCcw },
  { id: "loops",     label: "Loops",     icon: GitBranch },
  { id: "timeline",  label: "Timeline",  icon: AlignLeft },
  { id: "console",   label: "Console",   icon: Terminal },
];

// ── Logo ───────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #00d4ff22 0%, #00d4ff44 100%)",
          border: "1px solid #00d4ff44",
          boxShadow: "0 0 16px #00d4ff22",
        }}
      >
        <Cpu size={14} className="text-[#00d4ff]" />
      </div>
      <div>
        <div className="font-mono text-[13px] font-bold text-[#e2e8f0] leading-none tracking-tight">
          ContextOS
        </div>
        <div className="font-mono text-[9px] text-[#475569] mt-0.5 tracking-widest uppercase">
          Intelligence
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active, onChange }) {
  return (
    <aside
      className="flex flex-col shrink-0 border-r border-[#1e1e32]"
      style={{ width: 200, background: "#080810" }}
    >
      <Logo />

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            onClick={() => onChange(id)}
            className={`nav-item ${active === id ? "active" : ""}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* Source Status */}
      <div className="pb-4 pt-2 border-t border-[#1e1e32] mt-4">
        <SourceStatus />
      </div>
    </aside>
  );
}

// ── Panel router ───────────────────────────────────────────────────────────
function MainPanel({ active }) {
  let content;
  switch (active) {
    case "briefing":  content = <MorningBriefing />; break;
    case "today":     content = <FocusDebt />; break;
    case "loops":     content = <UnfinishedLoops />; break;
    case "timeline":  content = <ContextTimeline />; break;
    case "console":   content = <QueryConsole />; break;
    default:          content = <FocusDebt />; break;
  }
  return <ErrorBoundary key={active}>{content}</ErrorBoundary>;
}

// ── Right Panel — always-visible briefing ─────────────────────────────────
function RightPanel() {
  return (
    <aside
      className="flex flex-col shrink-0 border-l border-[#1e1e32] overflow-hidden"
      style={{ width: 280, background: "#08080e" }}
    >
      <ErrorBoundary>
        <MorningBriefing />
      </ErrorBoundary>
    </aside>
  );
}

// ── Header bar ────────────────────────────────────────────────────────────
function Header({ active }) {
  const item = NAV.find((n) => n.id === active);
  const Icon = item?.icon || Sun;

  return (
    <div
      className="flex items-center gap-3 px-6 py-3 border-b border-[#1e1e32] shrink-0"
      style={{ background: "#09090f" }}
    >
      <Icon size={14} className="text-[#00d4ff]" />
      <h1 className="text-[13px] font-semibold text-[#94a3b8]">
        {item?.label ?? "Dashboard"}
      </h1>
      <div className="flex-1" />
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="dot-pulse bg-[#10b981] w-[6px] h-[6px] rounded-full" />
        <span className="font-mono text-[10px] text-[#475569]">LIVE</span>
      </div>
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  const [activePanel, setActivePanel] = useState("briefing");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0a0a0f" }}>
      {/* Left Sidebar */}
      <Sidebar active={activePanel} onChange={setActivePanel} />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header active={activePanel} />
        <main className="flex-1 overflow-y-auto">
          <MainPanel active={activePanel} />
        </main>
      </div>

      {/* Right Panel */}
      <RightPanel />
    </div>
  );
}
