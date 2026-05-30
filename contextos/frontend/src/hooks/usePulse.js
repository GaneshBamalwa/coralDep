/** usePulse.js — manages pulse data: 90s polling + elaborate call */
import { useState, useEffect, useCallback, useRef } from "react";

export function usePulse() {
  const [sentence,    setSentence]    = useState("");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastData,    setLastData]    = useState(null);
  const [elaborating, setElaborating] = useState(false);
  const [elaboration, setElaboration] = useState(null);
  const intervalRef = useRef(null);

  const fetchCurrent = useCallback(async () => {
    try {
      const res  = await fetch("/api/pulse/current");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSentence(json.sentence || "");
      setLastData(json.data || null);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrent();
    intervalRef.current = setInterval(fetchCurrent, 90_000);
    return () => clearInterval(intervalRef.current);
  }, [fetchCurrent]);

  const elaborate = useCallback(async () => {
    setElaborating(true);
    setElaboration(null);
    try {
      const res  = await fetch("/api/pulse/elaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence, data: lastData }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setElaboration(json);
    } catch (e) {
      setElaboration({ error: e.message });
    } finally {
      setElaborating(false);
    }
  }, [sentence, lastData]);

  const refetchNow = useCallback(() => {
    setElaboration(null);
    setLoading(true);
    fetchCurrent();
  }, [fetchCurrent]);

  return { sentence, loading, error, elaborate, elaborating, elaboration, refetchNow };
}
