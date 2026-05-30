/**
 * exports.js — Meridian export action handlers
 *
 * Endpoints:
 *   POST /api/export  — routes { type, payload } to the correct handler
 *
 * Exports:
 *   executeExport(action, payload) — called by lens.js /execute
 */

import { Router } from "express";

export const exportRouter = Router();

// ── Handler stubs ─────────────────────────────────────────────────────────────

async function exportToCalendar(payload) {
  // TODO: POST to Google Calendar API using write-scoped OAuth token (not yet provisioned)
  // Requires: https://www.googleapis.com/auth/calendar.events scope
  // payload: { title, start, end, description }
  return { success: false, message: "Write token not yet provisioned for calendar" };
}

async function exportToNotion(payload) {
  // TODO: POST to Notion API — POST https://api.notion.com/v1/pages
  // Requires: Notion integration with write access
  // payload: { parentId, title, content }
  return { success: false, message: "Write token not yet provisioned for notion" };
}

async function exportToLinear(payload) {
  // TODO: POST to Linear API — POST https://api.linear.app/graphql
  // Requires: Linear API key with issue:create scope
  // payload: { teamId, title, description, priority }
  return { success: false, message: "Write token not yet provisioned for linear" };
}

async function generateShareSnapshot(payload) {
  // Fully implemented — serialise payload to a base64 data URL
  const json   = JSON.stringify({ snapshot: payload, generatedAt: new Date().toISOString() });
  const b64    = Buffer.from(json).toString("base64");
  return { success: true, url: `data:application/json;base64,${b64}` };
}

// ── Router ─────────────────────────────────────────────────────────────────────
const HANDLERS = {
  calendar: exportToCalendar,
  notion:   exportToNotion,
  linear:   exportToLinear,
  share:    generateShareSnapshot,
};

export async function executeExport(type, payload) {
  const handler = HANDLERS[type] || HANDLERS[Object.keys(HANDLERS).find(k => type?.includes(k))];
  if (!handler) return { success: false, message: `Unknown export type: ${type}` };
  return handler(payload);
}

exportRouter.post("/", async (req, res) => {
  try {
    const { type, payload = {} } = req.body;
    if (!type) return res.status(400).json({ error: "type is required" });
    const result = await executeExport(type, payload);
    res.status(result.success ? 200 : 501).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, success: false });
  }
});
