import { useState, useMemo } from "react";
import { Play, AlertTriangle, ChevronRight, Terminal, Database, Search, X, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useCoralQuery, useCoralSchema } from "../hooks/useCoral";

// ── Example query chips ────────────────────────────────────────────────────
const EXAMPLE_QUERIES = [
  {
    label: "Today's events",
    sql: "SELECT summary, start, end, status\nFROM google_calendar.events\nWHERE date(start) = date('now')\nORDER BY start ASC\nLIMIT 10",
  },
  {
    label: "Open PRs",
    sql: "SELECT number, title, state, updated_at, user__login\nFROM github.pulls\nWHERE owner = 'GaneshBamalwa'\nAND repo = 'coralHackathon'\nAND state = 'open'\nORDER BY updated_at DESC\nLIMIT 10",
  },
  {
    label: "Slack channels",
    sql: "SELECT name, num_members, topic\nFROM slack.channels\nLIMIT 20",
  },
  {
    label: "Gmail labels",
    sql: "SELECT id, name, type, message_list_visibility, label_list_visibility\nFROM gmail.labels\nLIMIT 20",
  },
  {
    label: "Notion search",
    sql: "SELECT id, object, last_edited_time, url\nFROM notion.search\nLIMIT 10",
  },
  {
    label: "All tables",
    sql: "SELECT schema_name, table_name, description\nFROM coral.tables\nORDER BY schema_name ASC",
  },
];

// ── Schema browser ─────────────────────────────────────────────────────────
const SCHEMA_COLORS = {
  github:          "#58a6ff",
  gmail:           "#ea4335",
  google_calendar: "#10b981",
  slack:           "#e879f9",
  notion:          "#e2e8f0",
  discord:         "#818cf8",
};

function SchemaTree({ schema, filter, onSelect }) {
  const [collapsed, setCollapsed] = useState({});

  const toggleSchema = (s) =>
    setCollapsed((prev) => ({ ...prev, [s]: !prev[s] }));

  const entries = useMemo(() => {
    if (!filter) return Object.entries(schema);
    const q = filter.toLowerCase();
    return Object.entries(schema)
      .map(([s, tables]) => [s, tables.filter((t) => t.toLowerCase().includes(q) || s.toLowerCase().includes(q))])
      .filter(([, tables]) => tables.length > 0);
  }, [schema, filter]);

  return (
    <div className="space-y-1">
      {entries.map(([schemaName, tables]) => {
        const color = SCHEMA_COLORS[schemaName] || "#475569";
        const isOpen = !collapsed[schemaName];
        return (
          <div key={schemaName}>
            <button
              onClick={() => toggleSchema(schemaName)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-[#151524] transition-colors"
            >
              {isOpen ? <ChevronDown size={11} className="text-[#475569]" /> : <ChevronRightIcon size={11} className="text-[#475569]" />}
              <span className="font-mono text-[11px] font-bold" style={{ color }}>
                {schemaName}
              </span>
              <span className="font-mono text-[9px] text-[#475569] ml-auto">{tables.length}</span>
            </button>
            {isOpen && (
              <div className="ml-5 border-l border-[#1e1e32] pl-2 space-y-0.5">
                {tables.map((table) => (
                  <button
                    key={table}
                    onClick={() => onSelect(schemaName, table)}
                    className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-[#00d4ff0a] hover:text-[#00d4ff] text-[#475569] transition-colors group"
                  >
                    <Database size={9} className="shrink-0" />
                    <span className="font-mono text-[11px] group-hover:text-[#00d4ff]">{table}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Results table ──────────────────────────────────────────────────────────
function ResultsTable({ columns, rows, isMock }) {
  if (!columns?.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest">
          Results — {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
        {isMock && (
          <span className="badge bg-[#f59e0b15] text-[#f59e0b] border border-[#f59e0b28]">mock</span>
        )}
      </div>
      <div className="overflow-auto rounded-lg border border-[#1e1e32] max-h-96">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center text-text-secondary py-8">
                  Query returned 0 rows
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col}>
                      {row[col] === null ? (
                        <span className="text-text-primary">NULL</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function QueryConsole() {
  const [sql, setSql] = useState(EXAMPLE_QUERIES[0].sql);
  const [showSchema, setShowSchema] = useState(false);
  const [schemaFilter, setSchemaFilter] = useState("");
  const { data, loading, error, runQuery } = useCoralQuery();
  const { schema, loading: schemaLoading, error: schemaError, fetchSchema } = useCoralSchema();

  const handleRun = () => {
    if (sql.trim()) runQuery(sql.trim());
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  const handleTableSelect = (schemaName, table) => {
    setSql(`SELECT * FROM ${schemaName}.${table} LIMIT 10`);
    setShowSchema(false);
  };

  const toggleSchema = () => {
    if (!showSchema && !schema) fetchSchema();
    setShowSchema((v) => !v);
  };

  return (
    <div className="p-6 space-y-5 fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary flex items-center gap-2">
            <Terminal size={16} className="text-text-primary" />
            Query Console
          </h2>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Run raw SQL against any Coral source ·{" "}
            <kbd className="font-mono text-[10px] bg-[#1e1e32] px-1.5 py-0.5 rounded">
              Ctrl+Enter
            </kbd>{" "}
            to execute
          </p>
        </div>

        {/* Browse Schema button */}
        <button
          id="browse-schema-btn"
          onClick={toggleSchema}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[12px] font-medium border transition-all ${
            showSchema
                ? "bg-[#00d4ff15] border-[#00d4ff44] text-accent"
                : "bg-[#0f0f1a] border-[#1e1e32] text-text-secondary hover:text-accent hover:border-accent/20"
          }`}
        >
          <Database size={13} />
          {showSchema ? "Hide Schema" : "Browse Schema"}
        </button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Schema panel */}
        {showSchema && (
              <div className="w-56 shrink-0 card p-3 flex flex-col gap-2 overflow-hidden">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              <input
                id="schema-search-input"
                value={schemaFilter}
                onChange={(e) => setSchemaFilter(e.target.value)}
                placeholder="Filter tables…"
                className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-[#0a0a14] border border-[#1e1e32] text-[11px] font-mono text-text-primary outline-none focus:border-accent placeholder-text-secondary"
              />
              {schemaFilter && (
                <button
                  onClick={() => setSchemaFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#e2e8f0]"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 mt-2 space-y-2">
              {schemaLoading && (
                <div className="space-y-1">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton h-5 w-full rounded" />
                  ))}
                </div>
              )}
              {schemaError && (
                <p className="text-[11px] text-[#ef4444] font-mono">{schemaError}</p>
              )}
              {schema && (
                <SchemaTree
                  schema={schema}
                  filter={schemaFilter}
                  onSelect={handleTableSelect}
                />
              )}
            </div>
          </div>
        )}

        {/* Editor + results */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Example chips */}
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q.label}
                id={`query-chip-${q.label.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => setSql(q.sql)}
                className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-[#0f0f1a] border border-[#1e1e32] text-[#475569] hover:text-[#00d4ff] hover:border-[#00d4ff33] transition-all"
              >
                <ChevronRight size={10} />
                {q.label}
              </button>
            ))}
          </div>

          {/* SQL editor */}
          <div className="relative">
            <textarea
              id="sql-editor"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={7}
              spellCheck={false}
              className="w-full rounded-lg bg-[#0a0a14] border border-[#1e1e32] focus:border-[#00d4ff44] text-[#e2e8f0] font-mono text-[13px] p-4 resize-y outline-none transition-colors placeholder-[#475569] leading-relaxed"
              placeholder="SELECT * FROM google_calendar.events LIMIT 10"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            />
            <span className="absolute bottom-3 right-3 font-mono text-[10px] text-[#475569]">
              {sql.split("\n").length} lines
            </span>
          </div>

          {/* Run button + row count */}
          <div className="flex items-center gap-4">
            <button
              id="run-query-btn"
              onClick={handleRun}
              disabled={loading || !sql.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-[13px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: loading ? "#00d4ff22" : "#00d4ff",
                color: loading ? "#00d4ff" : "#0a0a0f",
              }}
            >
              <Play size={13} className={loading ? "animate-pulse" : ""} />
              {loading ? "Running…" : "Run Query"}
            </button>

            {data && (
              <span className="font-mono text-[11px] text-[#10b981]">
                {data.rows?.length ?? 0} row{data.rows?.length !== 1 ? "s" : ""} returned
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-[#ef444412] border border-[#ef444433] flex items-start gap-2 text-[12px] text-[#ef4444] font-mono">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap break-words">{error}</pre>
            </div>
          )}

          {/* Results */}
          {data && !error && (
            <div className="fade-in">
              <ResultsTable columns={data.columns} rows={data.rows} isMock={data.mock} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
