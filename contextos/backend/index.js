import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { parseCoralOutput } from "./coralParser.js";
import {
  mockCalendarEvents,
  mockGithubPRs,
  mockSlackMessages,
  mockNotionTasks,
  mockDiscordMessages,
  mockFocusDebt,
  mockUnfinishedLoops,
  mockSources,
  mockBriefing,
} from "./mockData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MOCK_MODE = process.env.MOCK_MODE === "true";
const GITHUB_ENABLED = process.env.GITHUB_ENABLED === "true";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";

const openRouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "ContextOS",
      },
    })
  : null;

// ─────────────────────────────────────────────────────────────────────────────
// Core: run a Coral SQL query via CLI
// ─────────────────────────────────────────────────────────────────────────────
// Build a credential env object from .env so Coral can bypass the Windows keychain.
// When these env vars are present, Coral reads secrets from them directly.
function buildCoralEnv() {
  return {
    ...process.env,
    // GitHub
    ...(process.env.GITHUB_TOKEN   && { GITHUB_TOKEN:   process.env.GITHUB_TOKEN }),
    // Gmail (OAuth access token stored in .env)
    ...(process.env.GMAIL_ACCESS_TOKEN && { GMAIL_ACCESS_TOKEN: process.env.GMAIL_ACCESS_TOKEN }),
    // Google Calendar (OAuth access token stored in .env)
    ...(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN && { GOOGLE_CALENDAR_ACCESS_TOKEN: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN }),
    // Slack
    ...(process.env.SLACK_TOKEN    && { SLACK_TOKEN:    process.env.SLACK_TOKEN }),
    // Notion
    ...(process.env.NOTION_TOKEN   && { NOTION_TOKEN:   process.env.NOTION_TOKEN }),
  };
}

function runCoralQuery(sql, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    // Flatten multi-line SQL and escape double-quotes
    const normalized = sql.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
    const env = buildCoralEnv();

    // shell:false so env vars (GITHUB_TOKEN etc.) pass directly to coral.exe
    // without PowerShell stripping them — this bypasses the Windows keychain.
    exec(
      `coral sql "${normalized}"`,
      { timeout: timeoutMs, env, shell: false },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed || err.signal === 'SIGTERM') {
             return reject(new Error('timeout'));
          }
          return reject(new Error(stderr?.trim() || err.message));
        }
        resolve(stdout);
      }
    );
  });
}


// Safe wrapper — always resolves, never throws
async function safeQuery(sql, label = "unknown") {
  try {
    const stdout = await runCoralQuery(sql, 15000);
    const parsed = parseCoralOutput(stdout);
    return { ...parsed, source: label };
  } catch (err) {
    if (err.message === 'timeout') {
      console.warn(`[coral] ${label} failed: Query timed out`);
      return { columns: [], rows: [], source: label, source_error: 'Query timed out', timedOut: true };
    }
    console.warn(`[coral] ${label} failed:`, err.message);
    return { columns: [], rows: [], source: label, source_error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/query  — raw SQL console
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/query", async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== "string") {
    return res.status(400).json({ error: "sql field is required" });
  }

  if (MOCK_MODE) {
    return res.json({
      columns: ["result"],
      rows: [{ result: "MOCK_MODE=true — set MOCK_MODE=false and restart to run real queries" }],
      mock: true,
    });
  }

  try {
    const stdout = await runCoralQuery(sql, 30_000);
    return res.json(parseCoralOutput(stdout));
  } catch (err) {
    return res.status(500).json({ error: err.message, columns: [], rows: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/schema  — list all tables across all sources
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/schema", async (req, res) => {
  if (MOCK_MODE) {
    return res.json({
      columns: ["schema_name", "table_name"],
      rows: [
        { schema_name: "github",          table_name: "issues" },
        { schema_name: "github",          table_name: "pulls" },
        { schema_name: "github",          table_name: "commits" },
        { schema_name: "github",          table_name: "notifications" },
        { schema_name: "gmail",           table_name: "labels" },
        { schema_name: "google_calendar", table_name: "events" },
        { schema_name: "slack",           table_name: "channels" },
        { schema_name: "slack",           table_name: "users" },
        { schema_name: "notion",          table_name: "search" },
        { schema_name: "notion",          table_name: "databases" },
        { schema_name: "discord",         table_name: "guilds" },
        { schema_name: "discord",         table_name: "channels" },
        { schema_name: "discord",         table_name: "messages" },
      ],
      mock: true,
    });
  }

  try {
    const stdout = await runCoralQuery(
      "SELECT schema_name, table_name FROM coral.tables ORDER BY 1, 2",
      15_000
    );
    return res.json(parseCoralOutput(stdout));
  } catch (err) {
    return res.status(500).json({ error: err.message, columns: [], rows: [] });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/briefing  — parallel queries → Claude synthesis
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/briefing", async (req, res) => {
  let sources;

  if (MOCK_MODE) {
    sources = {
      calendar:      { rows: mockCalendarEvents,  source_error: null },
      github_issues: { rows: mockGithubPRs,       source_error: null },
      github_pulls:  { rows: mockGithubPRs,       source_error: null },
      slack_channels:{ rows: mockSlackMessages,   source_error: null },
      gmail_labels:  { rows: [],                  source_error: null },
      notion_search: { rows: mockNotionTasks,     source_error: null },
      discord:       { rows: mockDiscordMessages, source_error: null },
    };
  } else {
    const queries = {
      calendar: `SELECT summary, start_date_time, end_date_time, start_date, end_date, status FROM google_calendar.events LIMIT 10`,

      // GitHub conditionally enabled
      github_issues: GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
        ? `SELECT number, title, state, created_at, updated_at, comments FROM github.issues WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' AND state = 'open' ORDER BY updated_at DESC LIMIT 10`
        : null,
      github_pulls: GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
        ? `SELECT number, title, state, updated_at, user__login FROM github.pulls WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' AND state = 'open' ORDER BY updated_at DESC LIMIT 10`
        : null,

      slack_channels: `SELECT id, name, topic, num_members FROM slack.channels LIMIT 20`,

      gmail_inbox: `SELECT id, thread_id FROM gmail.messages WHERE label_ids = 'INBOX' LIMIT 10`,

      gmail_profile: `SELECT email_address, messages_total, threads_total FROM gmail.profile LIMIT 1`,

      notion_search: `SELECT * FROM notion.search LIMIT 10`,
    };

    // Run all queries in parallel; failed ones return source_error
    const entries = Object.entries(queries).filter(([, sql]) => sql !== null);
    const results = await Promise.allSettled(
      entries.map(([label, sql]) => safeQuery(sql, label))
    );

    sources = {};
    entries.forEach(([label], i) => {
      const r = results[i];
      sources[label] =
        r.status === "fulfilled"
          ? r.value
          : { rows: [], columns: [], source: label, source_error: r.reason?.message };
    });
  }

  // Collect failed sources for the response metadata
  const failed_sources = Object.entries(sources)
    .filter(([, v]) => v.source_error)
    .map(([k]) => k);

  // ── OpenRouter synthesis ──────────────────────────────────────────────────────
  let briefing = MOCK_MODE ? mockBriefing : null;

  if (!MOCK_MODE && openRouter) {
    try {
      // Build a rich but token-efficient payload for OpenRouter
      const calRows = sources.calendar?.rows || [];
      const slackRows = sources.slack_channels?.rows || [];
      const gmailInbox = sources.gmail_inbox?.rows || [];
      const gmailProfile = sources.gmail_profile?.rows?.[0] || {};
      const notionRows = sources.notion_search?.rows || [];

      const payload = {
        current_time: new Date().toISOString(),
        calendar_events: calRows.slice(0, 5).map(r => ({
          summary: r.summary,
          start: r.start_date_time || r.start_date,
          end: r.end_date_time || r.end_date,
          status: r.status,
        })),
        gmail: {
          email: gmailProfile.email_address,
          inbox_count: gmailInbox.length,
          total_messages: gmailProfile.messages_total,
        },
        slack_channels: slackRows.slice(0, 5).map(r => ({
          name: r.name, members: r.num_members, topic: r.topic || null,
        })),
        notion_tasks: notionRows.slice(0, 5).map(r => ({
          title: r.title || r.name, status: r.status,
        })),
      };

      const systemPrompt = `You are ContextOS, an AI morning briefing assistant. The user is a developer/maker.
Given their live workflow data, produce a helpful Morning Briefing as a JSON object with EXACTLY these keys:
- urgent: array of {item: string, source: string, reason: string} — things needing immediate attention
- waiting_on_you: array of {item: string, source: string, age_hours: number} — stale items waiting for the user
- best_focus_window: string — the best 2-hour block for deep work today based on calendar gaps
- summary: string — 2-3 upbeat, specific sentences about their day

If data for any section is sparse or missing, you MUST still generate useful fallback content for that section (e.g. suggest a focus block based on time of day if calendar is empty, note "inbox is clear" if Gmail returns zero messages). Be specific and encouraging. You MUST return valid JSON with EVERY expected key present, even if the value is a fallback string or empty array. Return ONLY valid JSON with no markdown fences.`;

      const completion = await openRouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `My workflow data as of ${new Date().toLocaleString()}:\n${JSON.stringify(payload, null, 2)}\n\nGenerate my Morning Briefing JSON.` }
        ],
        max_tokens: 800
      });

      let content = completion.choices[0].message.content.trim();
      if (content.startsWith("\`\`\`")) {
        content = content.replace(/^\`\`\`(?:json)?\n/, "").replace(/\n\`\`\`$/, "").trim();
      }
      try {
        briefing = JSON.parse(content);
      } catch (parseErr) {
        console.error("[openrouter] failed to parse JSON response:", parseErr.message);
        briefing = {
          urgent: [],
          waiting_on_you: [],
          best_focus_window: "Unable to compute — AI returned malformed data",
          summary: "We had trouble assembling your briefing. Please try again.",
          synthesis_error: "JSON Parse Error",
        };
      }
    } catch (err) {
      console.error("[openrouter] briefing synthesis failed:", err.message);
      briefing = {
        urgent: [],
        waiting_on_you: [],
        best_focus_window: "Unable to compute — OpenRouter API error",
        summary: "Briefing synthesis failed: " + err.message,
        synthesis_error: err.message,
      };
    }
  } else if (!MOCK_MODE && !openRouter) {
    // No OpenRouter key — build a minimal briefing from raw data directly
    briefing = buildFallbackBriefing(sources);
  }

  res.json({ briefing, sources, failed_sources });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/focus-debt
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/focus-debt", async (req, res) => {
  if (MOCK_MODE) return res.json(mockFocusDebt);

  const [notionResult, githubResult] = await Promise.all([
    safeQuery(
      "SELECT * FROM notion.search LIMIT 50",
      "notion"
    ),
    GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
      ? safeQuery(
          `SELECT * FROM github.issues WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' ORDER BY created_at DESC LIMIT 50`,
          "github"
        )
      : Promise.resolve({ rows: [], columns: [], source: "github", status: "disabled" }),
  ]);

  // Tally notion tasks by status
  let planned = 0;
  let completed = 0;
  for (const row of notionResult.rows) {
    planned++;
    const status = (row.status || row.object || "").toLowerCase();
    if (status.includes("done") || status.includes("complete")) completed++;
  }
  if (planned === 0) planned = notionResult.rows.length;

  // Group GitHub issues by day for the chart
  const dayMap = {};
  for (const row of githubResult.rows) {
    const day = new Date(row.created_at || row.updated_at).toLocaleDateString("en-US", { weekday: "short" });
    if (!dayMap[day]) dayMap[day] = { day, planned: 0, completed: 0 };
    dayMap[day].planned++;
    if ((row.state || "").toLowerCase() === "closed") dayMap[day].completed++;
  }

  res.json({
    planned,
    completed,
    byDay: Object.values(dayMap).slice(-7),
    failed_sources: [
      notionResult.source_error ? "notion" : null,
      githubResult.source_error ? "github" : null,
    ].filter(Boolean),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/unfinished-loops
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/unfinished-loops", async (req, res) => {
  if (MOCK_MODE) return res.json(mockUnfinishedLoops);

  const [githubResult, notionResult] = await Promise.all([
    GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
      ? safeQuery(
          `SELECT number, title, comments, updated_at, state FROM github.issues WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' AND state = 'open' AND comments >= 3 ORDER BY comments DESC LIMIT 20`,
          "github"
        )
      : Promise.resolve({ rows: [], columns: [], source: "github", status: "disabled" }),

    safeQuery("SELECT * FROM notion.search LIMIT 20", "notion"),
  ]);

  const loops = [
    ...githubResult.rows.map((r) => ({
      item: `#${r.number} — ${r.title}`,
      source: "github",
      touches: parseInt(r.comments, 10) || 0,
      last_touched: r.updated_at,
      description: `GitHub issue with ${r.comments} comments, still open`,
    })),
    ...notionResult.rows
      .filter((r) => {
        const s = (r.status || "").toLowerCase();
        return s.includes("progress") || s.includes("doing");
      })
      .map((r) => ({
        item: r.title || r.name || "(Untitled)",
        source: "notion",
        touches: 3,
        last_touched: r.last_edited_time || r.updated_at,
        description: `Status: "${r.status}" — stuck in progress`,
      })),
  ];

  res.json({
    loops,
    failed_sources: [
      githubResult.source_error ? "github" : null,
      notionResult.source_error ? "notion" : null,
    ].filter(Boolean),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sources
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/sources", async (req, res) => {
  if (MOCK_MODE) return res.json(mockSources);

  const KNOWN = ["google_calendar", "github", "gmail", "slack", "notion", "discord"];

  try {
    // Use coral.tables to infer which schemas are registered
    const stdout = await runCoralQuery(
      "SELECT schema_name, COUNT(*) as table_count FROM coral.tables GROUP BY schema_name ORDER BY 1",
      10_000
    );
    const { rows } = parseCoralOutput(stdout);
    const connectedMap = Object.fromEntries(rows.map((r) => [r.schema_name, r.table_count]));

    const sources = KNOWN.map((name) => ({
      name,
      connected: name in connectedMap,
      rows_cached: connectedMap[name] ? parseInt(connectedMap[name], 10) : null,
    }));

    return res.json(sources);
  } catch (err) {
    return res.json(
      KNOWN.map((name) => ({ name, connected: false, rows_cached: null, error: err.message }))
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mock_mode: MOCK_MODE,
    github_owner: GITHUB_OWNER || null,
    github_repo: GITHUB_REPO || null,
    openrouter_key: !!process.env.OPENROUTER_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fallback briefing builder (no Claude key)
// ─────────────────────────────────────────────────────────────────────────────
function buildFallbackBriefing(sources) {
  const urgent = [];
  const waiting_on_you = [];

  // Open PRs with recent activity
  for (const pr of (sources.github_pulls?.rows || []).slice(0, 2)) {
    urgent.push({
      item: `PR #${pr.number}: ${pr.title}`,
      source: "github",
      reason: `Open pull request last updated ${pr.updated_at}`,
    });
  }

  // Notion tasks
  for (const task of (sources.notion_search?.rows || []).slice(0, 3)) {
    waiting_on_you.push({
      item: task.title || task.name || "(untitled task)",
      source: "notion",
      age_hours: 24,
    });
  }

  // Calendar events today
  const events = (sources.calendar?.rows || []).slice(0, 2);
  const focusWindow =
    events.length >= 2
      ? `Between your meetings`
      : events.length === 1
      ? `After your ${events[0].summary || "meeting"}`
      : "Morning — no meetings found";

  const failedCount = Object.values(sources).filter((v) => v.source_error).length;

  return {
    urgent,
    waiting_on_you,
    best_focus_window: focusWindow,
    summary: `${urgent.length} urgent item(s) and ${waiting_on_you.length} task(s) need attention. ${failedCount > 0 ? `${failedCount} source(s) failed to load.` : "All sources loaded successfully."}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup check
// ─────────────────────────────────────────────────────────────────────────────
function validateEnv() {
  const reqTokens = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GMAIL_ACCESS_TOKEN: process.env.GMAIL_ACCESS_TOKEN,
    GOOGLE_CALENDAR_ACCESS_TOKEN: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    SLACK_TOKEN: process.env.SLACK_TOKEN
  };
  
  console.log(`\n🔍 Environment Validation:`);
  for (const [key, val] of Object.entries(reqTokens)) {
    if (val) {
      console.log(`   [✓] ${key} is present`);
    } else {
      console.log(`   [!] ${key} is missing`);
    }
  }
}

validateEnv();

// ─────────────────────────────────────────────────────────────────────────────
// Start — with graceful EADDRINUSE handling
// ─────────────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🟢 ContextOS backend running on http://localhost:${PORT}`);
  console.log(`   MOCK_MODE:          ${MOCK_MODE}`);
  console.log(`   GITHUB_OWNER/REPO:  ${GITHUB_OWNER}/${GITHUB_REPO || "(not set)"}`);
  console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? "set ✓" : "not set — using fallback briefing"}\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n🔴 Port ${PORT} is already in use. Kill the other process first:\n   npx kill-port ${PORT}\nOr set a different port in .env (PORT=3002)\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(() => {
    console.log("✓ Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
