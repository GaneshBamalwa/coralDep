import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { VertexAI } from "@google-cloud/vertexai";
import { GoogleAuth } from "google-auth-library";
import { parseCoralOutput } from "./coralParser.js";
import { detectSignals }    from "./signals.js";

// ── Meridian module imports ───────────────────────────────────────────────────
import { pulseRouter,    startPulseJob  } from "./pulse.js";
import { signalsRouter               } from "./signals.js";
import { lensRouter                  } from "./lens.js";
import { streamRouter,  startStreamJob } from "./stream.js";
import { pressureRouter              } from "./pressure.js";
import { timeRouter                  } from "./timeaware.js";
import { exportRouter                } from "./exports.js";
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

dotenv.config({ path: "../.env" });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MOCK_MODE = process.env.MOCK_MODE === "true";
const GITHUB_ENABLED = process.env.GITHUB_ENABLED === "true";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";

// ── Vertex AI setup ──────────────────────────────────────────────────────────
const vertexAI = new VertexAI({
  project: process.env.GCLOUD_PROJECT || "your-gcp-project-id",
  location: process.env.GCLOUD_LOCATION || "us-central1",
});

const geminiModel = vertexAI.getGenerativeModel({
  model: "gemini-2.5-pro",
});

async function generateBriefing(systemPrompt, userContext, retriesLeft = 1) {
  const request = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n${JSON.stringify(userContext, null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  const result = await geminiModel.generateContent(request);
  const response = result.response;
  const text = response.candidates[0].content.parts[0].text;

  try {
    return JSON.parse(text);
  } catch (e) {
    if (retriesLeft > 0) {
      console.warn("[vertex] JSON parsing failed or response truncated. Retrying once...");
      return generateBriefing(systemPrompt, userContext, retriesLeft - 1);
    }
    console.error("[vertex] Failed to parse JSON response:", text);
    return {
      situation: "Briefing generation failed - model returned malformed response.",
      beforeYouStart: [],
      watchOut: [],
      bestFocusWindow: "Unable to determine.",
      oneThing: "Check backend logs for Vertex AI errors.",
    };
  }
}

// ── Build Coral env (bypasses Windows keychain) ───────────────────────────────
function buildCoralEnv() {
  return {
    ...process.env,
    ...(process.env.GITHUB_TOKEN                && { GITHUB_TOKEN:                  process.env.GITHUB_TOKEN }),
    ...(process.env.GMAIL_ACCESS_TOKEN          && { GMAIL_ACCESS_TOKEN:            process.env.GMAIL_ACCESS_TOKEN }),
    ...(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN && { GOOGLE_CALENDAR_ACCESS_TOKEN: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN }),
    ...(process.env.SLACK_TOKEN                 && { SLACK_TOKEN:                   process.env.SLACK_TOKEN }),
    ...(process.env.NOTION_TOKEN                && { NOTION_TOKEN:                  process.env.NOTION_TOKEN, NOTION_API_KEY: process.env.NOTION_TOKEN }),
    ...(process.env.DISCORD_BOT_TOKEN           && { DISCORD_BOT_TOKEN:             process.env.DISCORD_BOT_TOKEN }),
  };
}

function runCoralQuery(sql, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const normalized = sql.replace(/\s+/g, " ").trim().replace(/"/g, '\\"');
    const env = buildCoralEnv();
    exec(
      `coral sql "${normalized}"`,
      { timeout: timeoutMs, env, shell: false },
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

async function safeQuery(sql, label = "unknown") {
  try {
    const stdout = await runCoralQuery(sql, 15000);
    const parsed = parseCoralOutput(stdout);
    return { ...parsed, source: label };
  } catch (err) {
    if (err.message === "timeout") {
      console.warn(`[coral] ${label} failed: Query timed out`);
      return { columns: [], rows: [], source: label, source_error: "Query timed out", timedOut: true };
    }
    console.warn(`[coral] ${label} failed:`, err.message);
    return { columns: [], rows: [], source: label, source_error: err.message };
  }
}

// ── POST /api/query ───────────────────────────────────────────────────────────
app.post("/api/query", async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== "string") {
    return res.status(400).json({ error: "sql field is required" });
  }
  if (MOCK_MODE) {
    return res.json({
      columns: ["result"],
      rows: [{ result: "MOCK_MODE=true -- set MOCK_MODE=false and restart to run real queries" }],
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

// ── GET /api/schema ───────────────────────────────────────────────────────────
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

// ── GET /api/briefing ─────────────────────────────────────────────────────────
app.get("/api/briefing", async (req, res) => {
  let sources;

  if (MOCK_MODE) {
    sources = {
      calendar:       { rows: mockCalendarEvents,  source_error: null },
      github_issues:  { rows: mockGithubPRs,       source_error: null },
      github_pulls:   { rows: mockGithubPRs,       source_error: null },
      slack_channels: { rows: mockSlackMessages,   source_error: null },
      gmail_labels:   { rows: [],                  source_error: null },
      notion_search:  { rows: mockNotionTasks,     source_error: null },
      discord:        { rows: mockDiscordMessages, source_error: null },
    };
  } else {
    const queries = {
      calendar:      `SELECT summary, start_date_time, end_date_time, start_date, end_date, status FROM google_calendar.events LIMIT 10`,
      github_issues: GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
        ? `SELECT number, title, state, created_at, updated_at, comments FROM github.issues WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' AND state = 'open' ORDER BY updated_at DESC LIMIT 10`
        : null,
      github_pulls: GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
        ? `SELECT number, title, state, updated_at, user__login FROM github.pulls WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' AND state = 'open' ORDER BY updated_at DESC LIMIT 10`
        : null,
      slack_channels: `SELECT id, name, topic, num_members FROM slack.channels LIMIT 20`,
      gmail_inbox:    `SELECT id, thread_id FROM gmail.messages WHERE label_ids = 'INBOX' LIMIT 10`,
      gmail_profile:  `SELECT email_address, messages_total, threads_total FROM gmail.profile LIMIT 1`,
      notion_search:  `SELECT * FROM notion.search LIMIT 10`,
    };

    const discordFetch = async () => {
      try {
        const guildsResult = await safeQuery("SELECT id, name FROM discord.guilds LIMIT 5", "discord_guilds");
        const firstGuildId = guildsResult.rows?.[0]?.id;
        if (!firstGuildId) return [];
        const channelsResult = await safeQuery(`SELECT id, name FROM discord.channels WHERE guild_id = '${firstGuildId}' LIMIT 10`, "discord_channels");
        const firstChannelId = channelsResult.rows?.[0]?.id;
        if (!firstChannelId) return [];
        const msgsResult = await safeQuery(`SELECT author__username, content, timestamp FROM discord.messages WHERE channel_id = '${firstChannelId}' AND limit = 20`, "discord_messages");
        return msgsResult.rows || [];
      } catch (e) {
        throw e;
      }
    };

    const entries = Object.entries(queries).filter(([, sql]) => sql !== null);
    
    // Fetch all SQL sources AND Discord sequentially-dependent queries in parallel
    const [results, discordRes] = await Promise.all([
      Promise.allSettled(entries.map(([label, sql]) => safeQuery(sql, label))),
      discordFetch().then(rows => ({ status: 'fulfilled', value: { rows, source_error: null } }))
                    .catch(e => ({ status: 'rejected', reason: e }))
    ]);

    sources = {};
    entries.forEach(([label], i) => {
      const r = results[i];
      sources[label] = r.status === "fulfilled"
        ? r.value
        : { rows: [], columns: [], source: label, source_error: r.reason?.message };
    });

    sources.discord = discordRes.status === "fulfilled" 
      ? discordRes.value 
      : { rows: [], source_error: discordRes.reason?.message };
  }

  const failed_sources = Object.entries(sources)
    .filter(([, v]) => v.source_error)
    .map(([k]) => k);

  // ── Synthesis ──────────────────────────────────────────────────────────────
  let briefing = MOCK_MODE ? mockBriefing : null;

  if (!MOCK_MODE) {
    const now      = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const calRows      = sources.calendar?.rows       || [];
    const slackRows    = sources.slack_channels?.rows  || [];
    const gmailInbox   = sources.gmail_inbox?.rows    || [];
    const gmailProfile = sources.gmail_profile?.rows?.[0] || {};
    const notionRows   = sources.notion_search?.rows  || [];
    const discordRows  = sources.discord?.rows        || [];

    // Derived signals
    const todayEvents = calRows
      .map(r => ({
        summary: r.summary,
        start: new Date((r.start_date_time || r.start_date || "").replace(/Z$/, "")),
        end:   new Date((r.end_date_time   || r.end_date   || "").replace(/Z$/, "")),
      }))
      .filter(e => !isNaN(e.start) && e.start.toISOString().startsWith(todayStr))
      .sort((a, b) => a.start - b.start);

    const minutesUntilFirstMeeting = todayEvents.length > 0
      ? Math.round((todayEvents[0].start - now) / 60000)
      : null;

    const totalMeetingMinutesToday = todayEvents.reduce(
      (sum, e) => sum + Math.max(0, Math.round((e.end - e.start) / 60000)), 0
    );

    let longestFreeBlockMinutes = 0;
    for (let i = 1; i < todayEvents.length; i++) {
      const gap = Math.round((todayEvents[i].start - todayEvents[i - 1].end) / 60000);
      if (gap > longestFreeBlockMinutes) longestFreeBlockMinutes = gap;
    }

    const backToBackCount = todayEvents.filter((e, i) => {
      if (i === 0) return false;
      return (e.start - todayEvents[i - 1].end) < 10 * 60 * 1000;
    }).length;

    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const overdueNotionTasks = notionRows.filter(t => {
      const due = t.due_date;
      return due && due <= todayStr && (t.status || "").toLowerCase() !== "done";
    });
    const staleTasks = notionRows.filter(t => {
      const edited = t.last_edited_time || t.updated_at;
      return edited && edited < threeDaysAgo;
    });

    const derived = {
      minutesUntilFirstMeeting,
      totalMeetingMinutesToday,
      longestFreeBlockMinutes,
      hasBackToBackMeetings: backToBackCount > 0,
      backToBackCount,
      overdueNotionTaskCount: overdueNotionTasks.length,
      staleTaskCount:         staleTasks.length,
      firstMeetingTitle:      todayEvents[0]?.summary || null,
      firstMeetingTime:       todayEvents[0]?.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) || null,
    };

    const context = {
      current_time:     now.toISOString(),
      derived,
      calendar_events:  todayEvents.map(e => ({
        summary: e.summary,
        start:   e.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        end:     e.end.toLocaleTimeString("en-US",   { hour: "numeric", minute: "2-digit" }),
      })),
      gmail:            { inbox_count: gmailInbox.length, total_messages: gmailProfile.messages_total },
      slack_channels:   slackRows.slice(0, 5).map(r => ({ name: r.name, members: r.num_members, topic: r.topic || null })),
      notion_tasks:     notionRows.slice(0, 8).map(r => ({ title: r.title || r.name, status: r.status, last_edited: r.last_edited_time })),
      urgent_notion_tasks: overdueNotionTasks.map(t => ({ title: t.title || t.name, due: t.due_date })),
      stale_tasks:      staleTasks.slice(0, 3).map(t => ({ title: t.title || t.name, last_edited: t.last_edited_time })),
      discord:          discordRows.slice(0, 10).map(r => ({ author: r.author__username, content: r.content, timestamp: r.timestamp })),
    };

    const sourcesWithData = [calRows, slackRows, gmailInbox, notionRows, discordRows].filter(s => s.length > 0).length;

    const systemPrompt = `You are a chief of staff with full visibility into this person's calendar, inbox, tasks, and team communications.

Your job is NOT to summarize each tool separately. You must reason across all sources together and surface only what actually matters.

You will produce a structured briefing with exactly these sections:

SITUATION: One sentence. What kind of day is today based on the data?

BEFORE YOU START: 2-3 specific actions to take RIGHT NOW before the first meeting. Be concrete - name the person, the task, the channel. No generic advice.

WATCH OUT: 1-3 things that look risky, conflicted, or falling through the cracks. Cross-reference sources - back-to-back meetings with no prep gap, overdue tasks, stale items.

BEST FOCUS WINDOW: Based on calendar gaps, tell them exactly when their best uninterrupted work block is today and what to use it for.

ONE THING: The single most important thing they should do in the next 30 minutes. One sentence, completely specific.

Rules:
- If something is fine, do not mention it
- Never say "it looks like" or "based on the data"
- Be direct, specific, and use names and times from the actual data
- If a section has nothing worth flagging, write "Clear." as the value
- ${sourcesWithData < 2 ? "Fewer than 2 sources have data - generate reasonable defaults for every section based on the current time of day." : ""}
- Return valid JSON with exactly these keys: situation, beforeYouStart, watchOut, bestFocusWindow, oneThing
- beforeYouStart and watchOut must be arrays of strings. All other values are strings.`;

    try {
      briefing = await generateBriefing(systemPrompt, context);
    } catch (e) {
      if (e.message?.includes("403")) {
        console.error("[vertex] Permission denied - ensure Vertex AI API is enabled:");
        console.error("[vertex] Run in PowerShell: gcloud services enable aiplatform.googleapis.com");
      } else if (e.message?.includes("429")) {
        console.error("[vertex] Quota exceeded - check your Vertex AI quota in GCP console");
      } else {
        console.error("[vertex] Unexpected error:", e.message);
      }
      briefing = {
        situation: "Briefing generation failed - check backend logs.",
        beforeYouStart: [],
        watchOut: [],
        bestFocusWindow: "Unable to compute - Vertex AI error.",
        oneThing: "Check backend logs for Vertex AI errors.",
        synthesis_error: e.message,
      };
    }
  }

  // ── Signal detection (runs on already-fetched data, no new Coral queries) ──
  const signals = detectSignals(sources);

  res.json({ briefing, signals, sources, failed_sources });
});

// ── GET /api/focus-debt ───────────────────────────────────────────────────────
app.get("/api/focus-debt", async (req, res) => {
  if (MOCK_MODE) return res.json(mockFocusDebt);

  const [notionResult, githubResult] = await Promise.all([
    safeQuery("SELECT * FROM notion.search LIMIT 50", "notion"),
    GITHUB_ENABLED && GITHUB_OWNER && GITHUB_REPO
      ? safeQuery(
          `SELECT * FROM github.issues WHERE owner = '${GITHUB_OWNER}' AND repo = '${GITHUB_REPO}' ORDER BY created_at DESC LIMIT 50`,
          "github"
        )
      : Promise.resolve({ rows: [], columns: [], source: "github", status: "disabled" }),
  ]);

  let planned = 0, completed = 0;
  for (const row of notionResult.rows) {
    planned++;
    const status = (row.status || row.object || "").toLowerCase();
    if (status.includes("done") || status.includes("complete")) completed++;
  }
  if (planned === 0) planned = notionResult.rows.length;

  const dayMap = {};
  for (const row of githubResult.rows) {
    const day = new Date(row.created_at || row.updated_at).toLocaleDateString("en-US", { weekday: "short" });
    if (!dayMap[day]) dayMap[day] = { day, planned: 0, completed: 0 };
    dayMap[day].planned++;
    if ((row.state || "").toLowerCase() === "closed") dayMap[day].completed++;
  }

  res.json({
    planned, completed,
    byDay: Object.values(dayMap).slice(-7),
    failed_sources: [
      notionResult.source_error  ? "notion" : null,
      githubResult.source_error  ? "github" : null,
    ].filter(Boolean),
  });
});

// ── GET /api/unfinished-loops ─────────────────────────────────────────────────
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
    ...githubResult.rows.map(r => ({
      item:         `#${r.number} - ${r.title}`,
      source:       "github",
      touches:      parseInt(r.comments, 10) || 0,
      last_touched: r.updated_at,
      description:  `GitHub issue with ${r.comments} comments, still open`,
    })),
    ...notionResult.rows
      .filter(r => { const s = (r.status || "").toLowerCase(); return s.includes("progress") || s.includes("doing"); })
      .map(r => ({
        item:         r.title || r.name || "(Untitled)",
        source:       "notion",
        touches:      3,
        last_touched: r.last_edited_time || r.updated_at,
        description:  `Status: "${r.status}" - stuck in progress`,
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

// ── GET /api/sources ──────────────────────────────────────────────────────────
app.get("/api/sources", async (req, res) => {
  if (MOCK_MODE) return res.json(mockSources);

  const KNOWN = ["google_calendar", "github", "gmail", "slack", "notion", "discord"];
  try {
    const stdout = await runCoralQuery(
      "SELECT schema_name, COUNT(*) as table_count FROM coral.tables GROUP BY schema_name ORDER BY 1",
      10_000
    );
    const { rows } = parseCoralOutput(stdout);
    const connectedMap = Object.fromEntries(rows.map(r => [r.schema_name, r.table_count]));
    return res.json(KNOWN.map(name => ({
      name,
      connected:   name in connectedMap,
      rows_cached: connectedMap[name] ? parseInt(connectedMap[name], 10) : null,
    })));
  } catch (err) {
    return res.json(KNOWN.map(name => ({ name, connected: false, rows_cached: null, error: err.message })));
  }
});

// ── GET /api/health ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:         "ok",
    mock_mode:      MOCK_MODE,
    github_owner:   GITHUB_OWNER || null,
    github_repo:    GITHUB_REPO  || null,
    gcloud_project: process.env.GCLOUD_PROJECT || null,
    timestamp:      new Date().toISOString(),
  });
});

// ── POST /api/chat ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, context = {}, history = [] } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message field is required" });
  }

  const systemPrompt = `You are a smart Chief of Staff. The user has already seen their morning briefing.
Help them act on it. Be concise, direct, and specific. Never re-summarise what they already know.
If context data is provided, use it — name specific meetings, tasks, people, and times.
Keep replies under 150 words unless the user explicitly asks for something longer.`;

  const contextBlock = Object.keys(context).length > 0
    ? `\n\nRelevant context:\n${JSON.stringify(context, null, 2)}`
    : "";

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: message + contextBlock }] },
  ];

  try {
    const request = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
    };
    const result = await geminiModel.generateContent(request);
    const reply  = result.response.candidates[0].content.parts[0].text;
    return res.json({ reply: reply.trim() });
  } catch (e) {
    console.error("[chat] LLM error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ── Fallback briefing (Vertex unavailable) ─────────────────────────────────
function buildFallbackBriefing(sources) {
  const beforeYouStart = [];
  for (const pr of (sources.github_pulls?.rows || []).slice(0, 2)) {
    beforeYouStart.push(`Review PR #${pr.number}: ${pr.title}`);
  }
  const events = (sources.calendar?.rows || []).slice(0, 2);
  const focusWindow = events.length >= 2 ? "Between your meetings"
    : events.length === 1 ? `After your ${events[0].summary || "meeting"}`
    : "Morning - no meetings found";
  const firstTask = (sources.notion_search?.rows || [])[0];

  return {
    situation:      "Briefing generated without AI synthesis.",
    beforeYouStart,
    watchOut:       [],
    bestFocusWindow: focusWindow,
    oneThing:       firstTask ? (firstTask.title || firstTask.name || "Review your tasks") : "Plan your day.",
  };
}

// ── Startup validation ─────────────────────────────────────────────────────
function validateEnv() {
  const tokens = {
    GMAIL_ACCESS_TOKEN:           process.env.GMAIL_ACCESS_TOKEN,
    GOOGLE_CALENDAR_ACCESS_TOKEN: process.env.GOOGLE_CALENDAR_ACCESS_TOKEN,
    NOTION_TOKEN:                 process.env.NOTION_TOKEN,
    SLACK_TOKEN:                  process.env.SLACK_TOKEN,
  };
  console.log(`\n🔍 Environment Validation:`);
  for (const [key, val] of Object.entries(tokens)) {
    console.log(`   [${val ? "✓" : "!"}] ${key} is ${val ? "present" : "missing"}`);
  }
  if (!process.env.GCLOUD_PROJECT) {
    console.warn("[env] WARNING: GCLOUD_PROJECT not set - Vertex AI calls will fail");
  }
  if (!process.env.GCLOUD_LOCATION) {
    console.warn("[env] WARNING: GCLOUD_LOCATION not set - defaulting to us-central1");
    process.env.GCLOUD_LOCATION = "us-central1";
  }
}

async function checkADC() {
  try {
    const auth   = new GoogleAuth();
    const client = await auth.getClient();
    const token  = await client.getAccessToken();
    if (token) console.log("[gcloud] ADC credentials valid ✓");
  } catch (e) {
    console.error("[gcloud] ADC credentials not found");
    console.error("[gcloud] Run in PowerShell: gcloud auth application-default login");
  }
}

validateEnv();
checkADC();

// ── Meridian API routes ───────────────────────────────────────────────────────
app.use("/api/pulse",       pulseRouter);
app.use("/api/signals",     signalsRouter);
app.use("/api/lens",        lensRouter);
app.use("/api/stream",      streamRouter);
app.use("/api/pressure",    pressureRouter);
app.use("/api/timecontext", timeRouter);
app.use("/api/export",      exportRouter);

// ── Server ────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🟢 ContextOS backend running on http://localhost:${PORT}`);
  console.log(`   MOCK_MODE:     ${MOCK_MODE}`);
  console.log(`   GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT || "(not set)"}`);
  console.log(`   GCLOUD_LOCATION: ${process.env.GCLOUD_LOCATION || "us-central1"}\n`);

  // Start Meridian background jobs after server is ready
  startPulseJob();
  startStreamJob();
  console.log("[meridian] Background jobs started (pulse: 90s, stream: 5m)");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n🔴 Port ${PORT} is already in use.\n   Run: npx kill-port ${PORT}\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

function shutdown(signal) {
  console.log(`\n${signal} received - shutting down gracefully...`);
  server.close(() => { console.log("✓ Server closed"); process.exit(0); });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
