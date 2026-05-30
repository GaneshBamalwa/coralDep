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

import { exec }         from "child_process";
import dotenv           from "dotenv";
import { VertexAI }     from "@google-cloud/vertexai";
import { parseCoralOutput } from "./coralParser.js";

dotenv.config({ path: "../.env" });

// ── Gemini setup ─────────────────────────────────────────────────────────────
const vertexAI = new VertexAI({
  project:  process.env.GCLOUD_PROJECT  || "your-gcp-project-id",
  location: process.env.GCLOUD_LOCATION || "us-central1",
});

export const geminiModel = vertexAI.getGenerativeModel({ model: "gemini-2.5-pro" });

export async function callGemini(prompt, { temperature = 0.4, maxOutputTokens = 1024 } = {}) {
  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  });
  return result.response.candidates[0].content.parts[0].text.trim();
}

export async function callGeminiJSON(prompt, opts = {}, retriesLeft = 1) {
  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
    },
  });
  const text = result.response.candidates[0].content.parts[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    if (retriesLeft > 0) {
      console.warn("[gemini] JSON parse failed (truncated?), retrying…");
      return callGeminiJSON(prompt, opts, retriesLeft - 1);
    }
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 120)}`);
  }
}

// ── Coral helpers ────────────────────────────────────────────────────────────
export function runCoralQuery(sql, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
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
  });
}

export async function safeQuery(sql, label = "unknown", timeoutMs = 15_000) {
  try {
    const stdout = await runCoralQuery(sql, timeoutMs);
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
