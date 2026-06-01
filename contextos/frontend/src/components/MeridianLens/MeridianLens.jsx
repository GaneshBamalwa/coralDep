import { useState, useEffect, useRef, useCallback } from "react";
import { Command } from "lucide-react";
import css from "./MeridianLens.module.css";
import { coralApiUrl } from "../../lib/coralApi";

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
      const res  = await fetch(coralApiUrl("/api/lens/execute"), {
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

function LensResponse({ response }) {
  if (!response) return null;
  const { type, content } = response;

  if (type === "text")  return <p className={css.responseText}>{content}</p>;
  if (type === "list")  return (
    <ul className={css.responseList}>
      {(Array.isArray(content) ? content : [content]).map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
  if (type === "action") return (
    <button className={css.responseAction}
      onClick={() => console.log("[lens execute]", content)}>
      {content?.label || "Execute action"}
    </button>
  );
  // chart → raw JSON for now
  return <pre className={css.responseCode}>{JSON.stringify(content, null, 2)}</pre>;
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
    fetch(coralApiUrl("/api/lens/suggestions"), {
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
      const res  = await fetch(coralApiUrl("/api/lens/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), context: { activeTab } }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResponse(json);
    } catch (e) {
      setResponse({ type: "text", content: `couldn't reach backend — ${e.message}` });
    } finally {
      setQuerying(false);
      setQuery("");
    }
  }, [query, activeTab]);

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
          <form onSubmit={handleQuery}>
            <div className={css.inputRow}>
              <span className={css.inputCaret}>_</span>
              <input
                ref={inputRef}
                className={css.input}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ask anything or run a command…"
              />
            </div>
          </form>

          {querying && (
            <div className={css.response}>
              <p className={css.thinking}>thinking…</p>
            </div>
          )}
          {response && !querying && (
            <div className={css.response}>
              <LensResponse response={response} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
