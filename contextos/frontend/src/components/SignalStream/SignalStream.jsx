import { useEffect, useState, useCallback } from "react";
import { Radio } from "lucide-react";
import css from "./SignalStream.module.css";
import { coralApiUrl } from "../../lib/coralApi";

const DOT_COLOR = { red: "#E53E3E", amber: "#DD6B20", blue: "#3182CE", green: "#38A169" };

function StreamCard({ card, onPin, onDismiss }) {
  const color = DOT_COLOR[card.dotStatus] || "#475569";
  return (
    <div className={`${css.card} ${card.pinned ? css.cardPinned : ""} ${card.expired ? css.cardExpired : ""}`}>
      <div className={css.cardTop}>
        <span className={css.cardDot} style={{ background: color }} />
        <span className={css.cardTitle}>{card.title}</span>
        <span className={css.cardAge}>{card.age || "now"}</span>
      </div>
      <p className={css.cardBody}>{card.body}</p>
      <div className={css.cardActions}>
        {(card.actions || []).slice(0, 2).map((act, i) => (
          <button key={i} className={css.cardAction}>{act.label}</button>
        ))}
        <span className={css.cardCtrl}>
          <button className={css.ctrlBtn} onClick={() => onPin(card.id)} title={card.pinned ? "Unpin" : "Pin"}>
            {card.pinned ? "📌" : "⬡"}
          </button>
          <button className={css.ctrlBtn} onClick={() => onDismiss(card.id)} title="Dismiss">×</button>
        </span>
      </div>
    </div>
  );
}

export default function SignalStream() {
  const [cards,   setCards]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchCards = useCallback(async () => {
    try {
      const res  = await fetch(coralApiUrl("/api/stream"));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCards(json.cards || []);
      setError(null);
    } catch (e) {
      setError("stream offline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
    const id = setInterval(fetchCards, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchCards]);

  const handlePin = useCallback(async (id) => {
    // Optimistic update
    setCards(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
    try {
      await fetch(coralApiUrl(`/api/stream/${id}/pin`), { method: "POST" });
    } catch {}
  }, []);

  const handleDismiss = useCallback(async (id) => {
    setCards(prev => prev.filter(c => c.id !== id));
    try {
      await fetch(coralApiUrl(`/api/stream/${id}`), { method: "DELETE" });
    } catch {}
  }, []);

  const sorted = [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div className={css.root}>
      <div className={css.header}>
        <span className={css.headerDot} />
        <span className={css.headerLabel}>Signal Stream</span>
        <Radio size={10} style={{ color: "#475569" }} />
      </div>

      <div className={css.list}>
        {loading && [1, 2].map(i => <div key={i} className={css.skeleton} />)}
        {!loading && error && <p className={css.error}>{error}</p>}
        {!loading && !error && sorted.length === 0 && (
          <p className={css.empty}>no signals yet — check back soon</p>
        )}
        {!loading && sorted.map(card => (
          <StreamCard key={card.id} card={card} onPin={handlePin} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>
  );
}
