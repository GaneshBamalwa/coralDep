/**
 * pulse.js — Meridian Pulse Bar: ambient background intelligence
 *
 * Endpoints:
 *   GET  /api/pulse/current    — returns the latest pulse sentence
 *   POST /api/pulse/elaborate  — expands the sentence into detailed insight + actions
 *
 * Background job (started externally via startPulseJob()):
 *   Runs every 90 seconds, fetches a live data snapshot from Coral,
 *   calls Gemini for a single insight sentence, stores it in memory.
 */

import { Router }                     from "express";
import { safeQuery, callGemini, callGeminiJSON } from "./shared.js";

export const pulseRouter = Router();

// ── In-memory state ───────────────────────────────────────────────────────────
let currentPulse = {
  sentence:    "Initialising ambient intelligence…",
  generatedAt: new Date().toISOString(),
  data:        null,
};

// ── Data snapshot fetch ───────────────────────────────────────────────────────
async function fetchPulseSnapshot() {
  const [calendar, gmail, github, slack] = await Promise.all([
    safeQuery("SELECT summary, start, end, status FROM google_calendar.events LIMIT 10", "calendar"),
    safeQuery("SELECT id, snippet, label_ids, internal_date FROM gmail.messages WHERE label_ids = 'INBOX' LIMIT 20", "gmail"),
    safeQuery("SELECT number, title, state, updated_at, user__login FROM github.pulls WHERE owner = 'GaneshBamalwa' AND repo = 'coralHackathon' LIMIT 10", "github"),
    safeQuery("SELECT id, name, num_members FROM slack.channels LIMIT 10", "slack"),
  ]);
  return { calendar: calendar.rows, gmail: gmail.rows, github: github.rows, slack: slack.rows };
}

// ── Generate pulse sentence ───────────────────────────────────────────────────
async function generatePulseSentence(snapshot) {
  const prompt = `You are a background intelligence system. Given this live data snapshot, generate EXACTLY ONE sentence that surfaces the single most important thing the user should be aware of right now.

Rules:
- Be specific: use names, numbers, time deltas
- No filler words ("it seems", "you might want to")
- No questions
- Max 120 characters
- Format: plain text, no markdown

Examples of good output:
"3 people are waiting on responses from you — oldest: Sarah, 2 days ago on PR #203"
"Auth migration PR has been open 18 hours with no reviewer assigned"
"Your next uninterrupted 90-min window starts at 2:15 PM"

Data: ${JSON.stringify(snapshot, null, 2)}`;

  const text = await callGemini(prompt, { temperature: 0.3, maxOutputTokens: 150 });
  // Strip quotes if model wraps the sentence
  return text.replace(/^["']|["']$/g, "").trim().slice(0, 140);
}

// ── Background job ────────────────────────────────────────────────────────────
export function startPulseJob() {
  const run = async () => {
    try {
      const snapshot = await fetchPulseSnapshot();
      const sentence = await generatePulseSentence(snapshot);
      currentPulse = { sentence, generatedAt: new Date().toISOString(), data: snapshot };
      console.log("[pulse] Updated:", sentence.slice(0, 80) + "…");
    } catch (e) {
      console.warn("[pulse] Cycle failed:", e.message);
    }
  };

  // Run immediately on start, then every 90 seconds
  run();
  return setInterval(run, 90_000);
}

// ── GET /current ──────────────────────────────────────────────────────────────
pulseRouter.get("/current", (req, res) => {
  res.json({
    sentence:    currentPulse.sentence,
    generatedAt: currentPulse.generatedAt,
    elaboration: null,
  });
});

// ── POST /elaborate ───────────────────────────────────────────────────────────
pulseRouter.post("/elaborate", async (req, res) => {
  try {
    const { sentence, data } = req.body;
    if (!sentence) return res.status(400).json({ error: "sentence is required" });

    const snapshot = data || currentPulse.data || {};

    const prompt = `You are a Chief of Staff briefing a developer. Expand this insight into 3-5 sentences with specific details, and suggest 2-3 quick actions.

Insight: "${sentence}"

Data context: ${JSON.stringify(snapshot, null, 2)}

Return ONLY this JSON object — no prose before or after, no markdown fences:
{
  "elaboration": "3-5 sentences with specific details, each under 40 words",
  "actions": [
    { "label": "short verb-first label", "type": "show_in_graph | export_calendar | add_to_notion | open_url" }
  ]
}
Be concise. Return only the JSON object. No prose before or after. No markdown fences.`;

    const result = await callGeminiJSON(prompt, { temperature: 0.2, maxOutputTokens: 800 });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Elaboration failed" });
  }
});
