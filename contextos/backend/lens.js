/**
 * lens.js — Meridian Lens: Cmd+K command palette handler
 *
 * Endpoints:
 *   POST /api/lens/suggestions — 3 suggested actions from current signals (no LLM)
 *   POST /api/lens/query       — natural language query handler (Gemini)
 *   POST /api/lens/execute     — routes to exports.js action handlers
 */

import { Router }              from "express";
import { annotateWithSignals } from "./signals.js";
import { callGeminiJSON }      from "./shared.js";
import { executeExport }       from "./exports.js";
import { get as cacheGet }     from "./cache.js";

export const lensRouter = Router();

const STATUS_ICON = {
  github_pulls: "pr", github_issues: "pr", calendar: "calendar",
  notion_search: "notion", slack_channels: "slack", gmail_inbox: "check", discord: "slack",
};

function rowsToSuggestions(annotatedData) {
  const candidates = [];
  for (const [key, source] of Object.entries(annotatedData)) {
    if (!source?.rows) continue;
    const icon = STATUS_ICON[key] || "check";
    for (const row of source.rows) {
      const sig = row._signal;
      if (!sig) continue;
      const priority = sig.status === "red" ? 0 : sig.status === "amber" ? 1 : sig.status === "blue" ? 2 : 3;
      const label = row.summary || row.title || row.name || row.snippet || row.id || "Item";
      candidates.push({
        priority,
        suggestion: {
          icon, payload: { key, item: row },
          label: `${sig.actions[0] || "View"}: ${String(label).slice(0, 60)} — ${sig.reason}`,
          action: (sig.actions[0] || "view").toLowerCase().replace(/\s+/g, "_"),
        },
      });
    }
  }
  return candidates
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map(c => c.suggestion);
}

lensRouter.post("/suggestions", async (req, res) => {
  try {
    const cached    = cacheGet("signals:annotated");
    const data      = cached || {};
    const annotated = annotateWithSignals(data);
    let suggestions = rowsToSuggestions(annotated);
    if (suggestions.length === 0) {
      suggestions = [
        { icon: "calendar", label: "Check today's schedule",   action: "view_calendar",   payload: {} },
        { icon: "check",    label: "Review inbox",             action: "view_gmail",      payload: {} },
        { icon: "pr",       label: "Check open pull requests", action: "view_github_prs", payload: {} },
      ];
    }
    res.json({ suggestions });
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Suggestions failed" });
  }
});

lensRouter.post("/query", async (req, res) => {
  try {
    const { query, context = {} } = req.body;
    if (!query) return res.status(400).json({ error: "query is required" });
    const prompt = `You are a command interface for a developer workflow dashboard. Answer using only the provided context. Be direct.

Response format (Return ONLY this JSON object — no prose before or after, no markdown fences):
{ "type": "text" | "list" | "action" | "chart", "content": <string|array|object> }
Be concise. Return only the JSON object. No prose before or after. No markdown fences.

Context: ${JSON.stringify(context, null, 2)}
Query: ${query}`;
    const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 800 });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Query failed" });
  }
});

lensRouter.post("/execute", async (req, res) => {
  try {
    const { action, payload = {} } = req.body;
    if (!action) return res.status(400).json({ error: "action is required" });
    const result = await executeExport(action, payload);
    res.status(result.success ? 200 : 501).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, success: false });
  }
});
