import { useState, useEffect } from "react";
import {
  Sun, GitBranch, RefreshCcw, AlignLeft, Terminal, Cpu, CalendarDays,
} from "lucide-react";

import MorningBriefing from "./components/MorningBriefing";
import FocusDebt from "./components/FocusDebt";
import UnfinishedLoops from "./components/UnfinishedLoops";
import ContextTimeline from "./components/ContextTimeline";
import QueryConsole from "./components/QueryConsole";
import SourceStatus from "./components/SourceStatus";
import TodayTab from "./components/TodayTab/TodayTab";
import SignalStream from "./components/SignalStream/SignalStream";
import MeridianLens from "./components/MeridianLens/MeridianLens";
import PulseBar from "./components/PulseBar/PulseBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SignalsProvider } from "./contexts/SignalsContext";
import { useLens } from "./hooks/useLens";

// ── Nav items ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "briefing", label: "Briefing", icon: Sun },
  { id: "today_tab", label: "TODAY", icon: CalendarDays },
  { id: "today", label: "Focus", icon: RefreshCcw },
  { id: "loops", label: "Loops", icon: GitBranch },
  { id: "timeline", label: "Timeline", icon: AlignLeft },
  { id: "console", label: "Console", icon: Terminal },
];

// ── Logo ───────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, rgba(11,95,83,0.08) 0%, rgba(11,95,83,0.16) 100%)",
          border: "1px solid rgba(11,95,83,0.12)",
          boxShadow: "0 0 16px rgba(11,95,83,0.08)",
        }}
      >
        <Cpu size={14} className="text-accent" />
      </div>
      <div>
        <div className="font-mono text-[13px] font-bold text-text-primary leading-none tracking-tight">
          Meridian
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active, onChange }) {
  return (
    <aside
      className="flex flex-col shrink-0 border-r border-bg-border glass-panel"
      style={{ width: 200 }}
    >
      <Logo />

      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            onClick={() => onChange(id)}
            className={`nav-item ${active === id ? "active" : ""}`}
          >
            <Icon size={14} />
            <span className="text-text-primary">{label}</span>
          </button>
        ))}
      </nav>

      <div className="pb-4 pt-2 border-t border-bg-border mt-4">
        <SourceStatus />
      </div>
    </aside>
  );
}

// ── Panel router ───────────────────────────────────────────────────────────
function MainPanel({ active }) {
  let content;
  switch (active) {
    case "briefing": content = <MorningBriefing />; break;
    case "today_tab": content = <TodayTab />; break;
    case "today": content = <FocusDebt />; break;
    case "loops": content = <UnfinishedLoops />; break;
    case "timeline": content = <ContextTimeline />; break;
    case "console": content = <QueryConsole />; break;
    default: content = <FocusDebt />; break;
  }
  return <ErrorBoundary key={active}>{content}</ErrorBoundary>;
}

// ── Right Panel — Signal Stream (top 40%) + Briefing (bottom 60%) ──────────
function RightPanel() {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 border-l border-bg-border overflow-hidden glass-panel"
      style={{ width: 280 }}
    >
      <ErrorBoundary>
        <SignalStream />
      </ErrorBoundary>
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
      className="flex items-center gap-3 px-6 py-3 border-b border-bg-border shrink-0 glass-strong"
    >
      <Icon size={14} className="text-accent" />
      <h1 className="text-[13px] font-semibold text-text-secondary">
        {item?.label ?? "Dashboard"}
      </h1>
      <div className="flex-1" />
      {/* Cmd+K hint */}
      <div className="hidden md:flex items-center gap-3">
        <div className="kbd-hint flex items-center gap-3">
          <kbd style={{ background: 'transparent', border: 'none', padding: 0 }}>⌘K</kbd>
          <span className="text-text-primary">Press</span>
          <span className="font-semibold text-text-primary">Ctrl/Cmd + K</span>
          <span className="text-text-secondary">to open Lens</span>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        <span className="dot-pulse bg-accent w-[6px] h-[6px] rounded-full" />
        <span className="font-mono text-[10px] text-text-secondary">LIVE</span>
      </div>
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  // Read initial panel from URL query param `?panel=...` so the extension can open a specific view.
  const initialPanel = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('panel')) || 'briefing';
  const [activePanel, setActivePanel] = useState(initialPanel);
  const { isOpen: lensOpen, close: closeLen } = useLens();
  const [backendUp, setBackendUp] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch("/api/health");
        if (!mounted) return;
        setBackendUp(res.ok);
      } catch (e) {
        if (!mounted) return;
        setBackendUp(false);
      }
    }
    check();
    const iv = setInterval(check, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return (
    <SignalsProvider>
      {/* Main layout — pb-8 reserves space for the 32px PulseBar */}
      {!backendUp && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-md text-sm font-mono text-[#ffe8e8] bg-[#5f001f] bg-opacity-90">
          API unreachable — start the backend (npm run dev from contextos)
        </div>
      )}
      <div className="flex h-screen overflow-hidden pb-8">
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

      {/* Meridian Lens — always mounted, rendered when isOpen */}
      <ErrorBoundary>
        <MeridianLens
          isOpen={lensOpen}
          onClose={closeLen}
          activeTab={activePanel}
        />
      </ErrorBoundary>

      {/* Pulse Bar — fixed bottom, always visible */}
      <PulseBar />
    </SignalsProvider>
  );
}
