/**
 * coralParser.js
 * Parses Coral CLI tabular stdout into { columns, rows }.
 *
 * Coral outputs pipe-formatted tables:
 *   +--------+-------+
 *   | col1   | col2  |
 *   +--------+-------+
 *   | val1   | val2  |
 *   +--------+-------+
 *
 * Also handles tab-separated output as a fallback.
 */

/**
 * @param {string} stdout - Raw stdout from `coral sql "..."`
 * @returns {{ columns: string[], rows: object[] }}
 */
export function parseCoralOutput(stdout) {
  if (!stdout || !stdout.trim()) return { columns: [], rows: [] };

  const lines = stdout.split("\n").filter((l) => l.trim());

  // ── Pipe-delimited format (primary — Coral's default) ─────────────────
  const pipeLines = lines.filter((l) => l.trim().startsWith("|"));

  if (pipeLines.length >= 2) {
    // First pipe line = headers
    const columns = pipeLines[0]
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    const rows = pipeLines.slice(1).map((line) => {
      const values = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      return Object.fromEntries(
        columns.map((col, i) => {
          const raw = values[i] ?? null;
          return [col, normalizeValue(raw)];
        })
      );
    });

    return { columns, rows };
  }

  // ── Tab-separated fallback ─────────────────────────────────────────────
  const dataLines = lines.filter((l) => !/^[-=+]+$/.test(l.trim()));
  if (dataLines.length >= 2) {
    const columns = dataLines[0].split("\t").map((c) => c.trim()).filter(Boolean);
    if (columns.length > 0) {
      const rows = dataLines.slice(1).map((line) => {
        const values = line.split("\t").map((c) => c.trim());
        return Object.fromEntries(
          columns.map((col, i) => [col, normalizeValue(values[i] ?? null)])
        );
      });
      return { columns, rows };
    }
  }

  return { columns: [], rows: [] };
}

/**
 * Coerce Coral's string representations to proper JS types.
 */
function normalizeValue(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "NULL" || s === "null" || s === "") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  // Integer
  if (/^\d+$/.test(s)) {
    if (s.length >= 16) return s;
    return parseInt(s, 10);
  }
  // Float
  if (/^\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}
