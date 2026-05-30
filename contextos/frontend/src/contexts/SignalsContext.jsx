/**
 * SignalsContext.jsx
 * Fetches /api/signals once on app load, builds a flat id→_signal map,
 * provides getSignal(id) to any component without re-fetching.
 */
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const SignalsContext = createContext({ signals: null, loading: false, getSignal: () => null });

export function SignalsProvider({ children }) {
  const [signals,  setSignals]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [signalMap, setSignalMap] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/signals")
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setSignals(data);
        // Build flat id → _signal map from all sources
        const map = new Map();
        for (const source of Object.values(data)) {
          if (!source?.rows) continue;
          for (const row of source.rows) {
            if (!row._signal) continue;
            // Try multiple id fields
            const ids = [row.id, row.number, row.thread_id, row.summary, row.name, row.title]
              .filter(Boolean)
              .map(String);
            for (const id of ids) map.set(id, row._signal);
          }
        }
        setSignalMap(map);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const getSignal = useCallback((id) => signalMap.get(String(id)) ?? null, [signalMap]);

  return (
    <SignalsContext.Provider value={{ signals, loading, getSignal }}>
      {children}
    </SignalsContext.Provider>
  );
}

export function useSignals() {
  return useContext(SignalsContext);
}
