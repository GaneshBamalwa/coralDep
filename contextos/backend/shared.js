/**
 * shared.js — Shared Coral + Gemini utilities for Meridian backend modules
 *
 * Exports:
 *   runCoralQuery(sql, timeoutMs)  — run a Coral SQL query
 *   safeQuery(sql, label, ms)     — run query, never throw, return partial on error
 *   geminiModel                   — configured VertexAI Gemini model instance
 *   callGemini(prompt, opts)      — one-shot LLM call returning text
 *   callGeminiJSON(prompt, opts)  — one-shot LLM call that parses + returns JSON
 */

import PQueue from "p-queue";
import { exec }         from "child_process";
import dotenv           from "dotenv";
import { parseCoralOutput } from "./coralParser.js";

dotenv.config({ path: "../.env" });

export const coralQueue = new PQueue({ concurrency: 2 });

// ── Gemini setup ─────────────────────────────────────────────────────────────
let _geminiModel = null;
export async function getGeminiModel() {
  if (!_geminiModel) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing_key");
    _geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return _geminiModel;
}

/**
 * parseGeminiJSON — resilient JSON extractor.
 * Handles: markdown fences, truncated objects, stray prose wrappers.
 */
export function parseGeminiJSON(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Empty response from Gemini");

  let text = raw.trim();

  // Strip markdown code fences if present
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Attempt direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Count open braces/brackets to determine how many closers are missing
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escaped = false;

    for (const ch of text) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
    }

    // If we're inside a string when cut off, close it first
    let recovered = text;
    if (inString) recovered += '"';

    // Close any open structures
    recovered += ']'.repeat(Math.max(0, brackets));
    recovered += '}'.repeat(Math.max(0, braces));

    try {
      const parsed = JSON.parse(recovered);
      console.warn("[gemini] Recovered truncated JSON by closing open structures");
      return parsed;
    } catch (e2) {
      throw new Error(`No JSON structure found in Gemini response: ${text.slice(0, 300)}`);
    }
  }
}

export async function callGemini(prompt, { temperature = 0.4, maxOutputTokens = 8192 } = {}) {
  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  });
  return result.response.candidates[0].content.parts[0].text.trim();
}

export async function callGeminiJSON(prompt, opts = {}) {
  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature:      opts.temperature      ?? 0.2,
      maxOutputTokens:  opts.maxOutputTokens  ?? 8192,
    },
  });
  const text = result.response.candidates[0].content.parts[0].text.trim();
  // Use the hardened parser — no blind retry (same prompt with same limit will truncate again)
  return parseGeminiJSON(text);
}

// ── Coral helpers ────────────────────────────────────────────────────────────
export function runCoralQuery(sql, timeoutMs = 30_000) {
  return coralQueue.add(() => new Promise((resolve, reject) => {
    const normalized = sql.replace(/\s+/g, " ").trim().replace(/"/g, '\\"');
    exec(
      `coral sql "${normalized}"`,
      { timeout: timeoutMs, env: process.env, shell: false },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed || err.signal === "SIGTERM") return reject(new Error("timeout"));
          return reject(new Error(stderr?.trim() || err.message));
        }
        resolve(stdout);
      }
    );
  }));
}

export function enforceSQLLimit(sql) {
  const trimmed = sql.trim();
  if (/\bLIMIT\s+\d+\s*;?$/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.endsWith(";")) {
    return `${trimmed.slice(0, -1)} LIMIT 100;`;
  }
  return `${trimmed} LIMIT 100`;
}

export async function safeQuery(sql, label = "unknown", timeoutMs = 15_000) {
  try {
    const limitedSql = enforceSQLLimit(sql);
    const stdout = await runCoralQuery(limitedSql, timeoutMs);
    const parsed = parseCoralOutput(stdout);
    return { ...parsed, source: label };
  } catch (err) {
    const isTimeout = err.message === "timeout";
    return {
      columns: [], rows: [], source: label,
      source_error: isTimeout ? "Query timed out" : err.message,
      timedOut: isTimeout,
    };
  }
}

// ── Shared time helpers ───────────────────────────────────────────────────────
export const hoursAgo  = (d) => d ? (Date.now() - new Date(String(d).replace(/Z$/, ""))) / 3_600_000 : 0;
export const daysAgo   = (d) => hoursAgo(d) / 24;
export const fmtTime   = (d) => {
  const dt = new Date(String(d || "").replace(/Z$/, ""));
  return isNaN(dt) ? "?" : dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
