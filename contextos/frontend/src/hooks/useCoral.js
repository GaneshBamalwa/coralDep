import { useState, useCallback, useRef } from "react";

/**
 * useCoral — generic fetch hook for /api/* endpoints.
 * Handles source_error and failed_sources fields from live endpoints.
 *
 * Returns { data, loading, error, failedSources, timedOutSources, refetch }
 */
export const unwrap = (res) => res?.data?.rows ?? res?.rows ?? res?.data ?? res ?? [];
export function useCoral(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [failedSources, setFailedSources] = useState([]);
  const [timedOutSources, setTimedOutSources] = useState([]);
  const abortRef = useRef(null);

  const fetchData = useCallback(
    async (bodyOrParams) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setFailedSources([]);
      setTimedOutSources([]);

      try {
        const isPost = options.method === "POST";
        const res = await fetch(endpoint, {
          method: isPost ? "POST" : "GET",
          headers: isPost ? { "Content-Type": "application/json" } : undefined,
          body: isPost ? JSON.stringify(bodyOrParams) : undefined,
          signal: controller.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}`);
        }

        const json = await res.json();

        // Surface failed_sources array from briefing/live endpoints
        if (Array.isArray(json.failed_sources) && json.failed_sources.length > 0) {
          setFailedSources(json.failed_sources);
        }

        // Surface top-level source_error (single-source endpoints)
        if (json.source_error) {
          setError(json.source_error);
        }

        // Identify timed out sources specifically if any
        if (json.sources) {
          const timedOut = Object.entries(json.sources)
            .filter(([, v]) => v?.timedOut)
            .map(([k]) => k);
          if (timedOut.length > 0) setTimedOutSources(timedOut);
        }

        setData(json);
        return json;
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [endpoint, options.method]
  );

  return { data, loading, error, failedSources, timedOutSources, refetch: fetchData };
}

/**
 * useCoralQuery — POST /api/query hook
 */
export function useCoralQuery() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runQuery = useCallback(async (sql) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      return json;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, runQuery };
}

/**
 * useCoralSchema — GET /api/schema hook
 * Returns tables grouped by schema_name: { [schema]: string[] }
 */
export function useCoralSchema() {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schema");
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Group rows by schema_name
      const grouped = {};
      for (const row of json.rows || []) {
        const s = row.schema_name;
        if (!grouped[s]) grouped[s] = [];
        grouped[s].push(row.table_name);
      }
      setSchema(grouped);
      return grouped;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { schema, loading, error, fetchSchema };
}

/**
 * useChat — POST /api/chat hook for the Chief of Staff conversation panel.
 * Manages conversation history and loading state.
 */
export function useChat() {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);

  const sendMessage = useCallback(async (message, context = {}) => {
    setLoading(true);
    setError(null);

    const nextHistory = [...history, { role: "user", content: message }];
    setHistory(nextHistory);

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message, context, history }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setHistory([...nextHistory, { role: "model", content: json.reply }]);
      return json.reply;
    } catch (err) {
      setError(err.message);
      // Remove the optimistically-added user message on failure
      setHistory(history);
    } finally {
      setLoading(false);
    }
  }, [history]);

  const reset = useCallback(() => {
    setHistory([]);
    setError(null);
  }, []);

  return { history, loading, error, sendMessage, reset };
}
