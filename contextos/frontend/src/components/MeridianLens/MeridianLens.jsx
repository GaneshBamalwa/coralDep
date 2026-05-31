import { useState, useEffect, useRef, useCallback } from "react";
import { Command } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import css from "./MeridianLens.module.css";

const ICON_MAP = {
  pr:       "⬡",
  calendar: "📅",
  check:    "✓",
  slack:    "#",
  notion:   "N",
};

function SuggestionRow({ s, activeTab }) {
  const [result, setResult] = useState(null);
  const [busy,   setBusy]   = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const res  = await fetch("/api/lens/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: s.action, payload: s.payload }),
      });
      const json = await res.json();
      setResult(json.message || (json.success ? "Done!" : "Action unavailable."));
    } catch {
      setResult("Couldn't reach backend.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className={css.suggestionItem} onClick={handleClick} disabled={busy}>
        <span className={css.suggIcon}>{ICON_MAP[s.icon] || "·"}</span>
        <span className={css.suggLabel}>{s.label}</span>
        {busy && <span className={css.thinking}>…</span>}
      </button>
      {result && <p className={css.suggResult}>{result}</p>}
    </div>
  );
}

function ResultsTable({ columns, rows }) {
  if (!columns?.length) return null;
  return (
    <div className="overflow-auto max-h-60 rounded-lg border border-[#1e1e32]">
      <table className="w-full text-left text-[11px] border-collapse">
        <thead className="bg-[#151524] text-text-secondary sticky top-0 font-mono">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium border-b border-[#1e1e32]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e32]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-4 text-center text-text-secondary">
                No results found
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-[#151524]/50 transition-colors">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-[#e2e8f0] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={row[col]}>
                    {row[col] === null ? <span className="text-text-secondary">NULL</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function MeridianLens({ isOpen, onClose, activeTab }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [query,       setQuery]       = useState("");
  const [querying,    setQuerying]    = useState(false);
  const [response,    setResponse]    = useState(null);
  const inputRef = useRef(null);

  // Load suggestions whenever the lens opens
  useEffect(() => {
    if (!isOpen) { setQuery(""); setResponse(null); return; }
    inputRef.current?.focus();
    setLoadingSugg(true);
    fetch("/api/lens/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { activeTab, currentTime: new Date().toISOString() } }),
    })
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSugg(false));
  }, [isOpen, activeTab]);

  const handleQuery = useCallback(async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setQuerying(true);
    setResponse(null);
    try {
      const res  = await fetch("/api/meridian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to query");
      setResponse(json);
    } catch (e) {
      setResponse({ error: e.message });
    } finally {
      setQuerying(false);
      setQuery("");
    }
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className={css.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={css.palette} role="dialog" aria-modal="true" aria-label="Meridian Lens">
        {/* Header */}
        <div className={css.header}>
          <Command size={13} style={{ color: "var(--accent-cta)" }} />
          <span className={css.headerTitle}>Meridian Lens</span>
          <span className={css.escHint}>ESC</span>
        </div>

        {/* Suggestions */}
        <div className={css.suggestions}>
          <p className={css.suggestionsLabel}>Suggested now</p>
          {loadingSugg
            ? [1, 2, 3].map(i => <div key={i} className={css.skeleton} />)
            : suggestions.map((s, i) => <SuggestionRow key={i} s={s} activeTab={activeTab} />)
          }
        </div>

        {/* Free text input */}
        <div className={css.inputArea}>
          <form onSubmit={handleQuery} className="flex gap-2">
            <div className={css.inputRow}>
              <span className={css.inputCaret}>_</span>
              <input
                ref={inputRef}
                className={css.input}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ask anything about your work... e.g. What are my open PRs?"
              />
            </div>
            <button type="submit" disabled={querying || !query.trim()} className="px-4 py-2 bg-[#00d4ff] text-[#0a0a0f] text-[12px] font-semibold rounded-lg disabled:opacity-50">
              Ask
            </button>
          </form>

          {/* Placeholder suggestions */}
          {!response && !querying && (
             <div className="mt-3 flex flex-wrap gap-2">
               {["What meetings do I have today?", "Show me my unread Slack channels", "What are my open GitHub PRs?", "What was edited in Notion recently?", "Show me recent Discord messages"].map(q => (
                 <button key={q} onClick={() => setQuery(q)} className="text-[10px] text-text-secondary bg-[#151524] px-2 py-1 rounded hover:text-accent transition-colors">
                   {q}
                 </button>
               ))}
             </div>
          )}

          {querying && (
            <div className={css.response}>
              <div className="flex items-center gap-2 text-text-secondary text-[12px] font-mono">
                 <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                 Generating SQL...
              </div>
            </div>
          )}
          {response && !querying && (
            <div className={css.response}>
              {response.error ? (
                 <div className="text-[#ef4444] text-[12px] font-mono">
                   <p className="mb-2">Error: {response.error}</p>
                   {response.sql && (
                     <div className="mt-2 p-2 bg-[#151524] rounded border border-[#1e1e32]">
                       <p className="text-[10px] text-text-secondary mb-1">Attempted SQL:</p>
                       <pre className="text-[#e2e8f0] whitespace-pre-wrap">{response.sql}</pre>
                     </div>
                   )}
                 </div>
              ) : response.isEmpty || !response.rows || response.rows.length === 0 ? (
                 <div className="meridian-empty flex flex-col items-center justify-center py-8 text-center border border-[#1e1e32] rounded-lg bg-[#151524]">
                   <p className="text-[13px] text-[#e2e8f0] font-medium mb-1">No results found</p>
                   <p className="meridian-empty-sub text-[11px] text-text-secondary">
                     The query ran successfully but returned no matching data.
                   </p>
                   {response.sql && (
                     <div className="mt-4 p-2 mx-4 bg-[#0a0a0f] rounded border border-[#1e1e32] text-left self-stretch">
                       <p className="text-[10px] text-text-secondary mb-1 font-mono uppercase">Attempted SQL:</p>
                       <pre className="text-[10px] text-[#00d4ff] font-mono whitespace-pre-wrap">{response.sql}</pre>
                     </div>
                   )}
                 </div>
              ) : (
                 <div className="meridian-response flex flex-col gap-4">
                   {/* Primary: Groq natural language response */}
                   <div className={`meridian-response-text text-[13px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap bg-[#151524] p-4 rounded-lg border border-[#1e1e32] ${css.markdownText}`}>
                     <ReactMarkdown>
                       {response.response}
                     </ReactMarkdown>
                   </div>
                   
                   {/* Secondary: collapsible raw data table */}
                   <details className="meridian-raw border border-[#1e1e32] rounded-lg bg-[#151524] overflow-hidden group">
                     <summary className="p-3 text-[11px] text-text-secondary cursor-pointer hover:text-[#00d4ff] font-mono select-none list-none flex justify-between items-center outline-none">
                       <span>View raw data ({response.rows.length} rows)</span>
                       <span className="text-[14px] group-open:rotate-180 transition-transform">↓</span>
                     </summary>
                     <div className="border-t border-[#1e1e32] overflow-auto max-h-60">
                       <table className="w-full text-left text-[11px] border-collapse">
                         <thead className="bg-[#0a0a0f] text-text-secondary sticky top-0 font-mono">
                           <tr>
                             {Object.keys(response.rows[0]).map(key => (
                               <th key={key} className="px-3 py-2 font-medium border-b border-[#1e1e32]">{key}</th>
                             ))}
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-[#1e1e32]">
                           {response.rows.map((row, i) => (
                             <tr key={i} className="hover:bg-[#1e1e32]/30 transition-colors">
                               {Object.values(row).map((val, j) => (
                                 <td key={j} className="px-3 py-2 text-[#e2e8f0] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={String(val ?? '')}>
                                   {String(val ?? '')}
                                 </td>
                               ))}
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   </details>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
