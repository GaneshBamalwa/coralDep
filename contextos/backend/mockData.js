/**
 * mockData.js
 * Realistic mock data returned when MOCK_MODE=true or Coral binary is unavailable.
 * All timestamps are relative to "now" so the dashboard always looks live.
 */

const now = () => new Date();
const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();
const today = () => new Date().toISOString().split("T")[0];
const daysFromNow = (d) => new Date(Date.now() + d * 86_400_000).toISOString().split("T")[0];

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------
export const mockCalendarEvents = [
  {
    summary: "Weekly Eng Sync",
    start: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
  },
  {
    summary: "1:1 with Maya",
    start: new Date(new Date().setHours(11, 30, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
  },
  {
    summary: "Product Review — Q3 Roadmap",
    start: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    end: new Date(new Date().setHours(15, 30, 0, 0)).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------
export const mockGithubPRs = [
  {
    number: 412,
    title: "feat: Add Coral HTTP source fallback strategy",
    state: "open",
    updated_at: hoursAgo(2),
  },
  {
    number: 408,
    title: "fix: Race condition in query parser under high concurrency",
    state: "open",
    updated_at: hoursAgo(18),
  },
  {
    number: 401,
    title: "chore: Upgrade Anthropic SDK to v0.29",
    state: "open",
    updated_at: daysAgo(3),
  },
  {
    number: 398,
    title: "docs: Document discord source manifest format",
    state: "open",
    updated_at: daysAgo(5),
  },
];

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------
export const mockSlackMessages = [
  {
    text: "@you can you review PR #412 before EOD? It's blocking the release.",
    ts: hoursAgo(1),
    channel: "#engineering",
    is_mentioned: true,
  },
  {
    text: "@you the Coral demo is set for Friday 3pm — confirm?",
    ts: hoursAgo(4),
    channel: "#product",
    is_mentioned: true,
  },
  {
    text: "@you quick question on the auth flow in the Discord source",
    ts: hoursAgo(8),
    channel: "#coral-hackathon",
    is_mentioned: true,
  },
];

// ---------------------------------------------------------------------------
// Notion
// ---------------------------------------------------------------------------
export const mockNotionTasks = [
  {
    title: "Write Coral source spec documentation",
    due_date: today(),
    status: "In Progress",
  },
  {
    title: "Review Q3 roadmap deck",
    due_date: daysFromNow(1),
    status: "Not Started",
  },
  {
    title: "Deploy ContextOS to staging",
    due_date: daysFromNow(2),
    status: "In Progress",
  },
  {
    title: "Send follow-up to design team",
    due_date: daysFromNow(3),
    status: "Not Started",
  },
];

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------
export const mockDiscordMessages = [
  {
    content: "@you hey, the Discord source manifest looks great — can you add rate-limit docs?",
    timestamp: hoursAgo(3),
    author_username: "alex_dev",
    has_mentions: true,
  },
  {
    content: "@you the search_guild_messages fallback logic — should it be regex or substring?",
    timestamp: hoursAgo(7),
    author_username: "priya_ml",
    has_mentions: true,
  },
];

// ---------------------------------------------------------------------------
// Focus Debt (last 7 days)
// ---------------------------------------------------------------------------
export const mockFocusDebt = {
  planned: 28,
  completed: 19,
  byDay: Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86_400_000);
    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    const planned = Math.floor(Math.random() * 3) + 3;
    const completed = Math.floor(Math.random() * planned) + 1;
    return { day: label, planned, completed };
  }),
};

// ---------------------------------------------------------------------------
// Unfinished Loops
// ---------------------------------------------------------------------------
export const mockUnfinishedLoops = [
  {
    item: "Refactor authentication middleware",
    source: "github",
    touches: 7,
    last_touched: daysAgo(2),
    description: "Issue #389 — 7 comments, multiple partial commits, still open after 14 days",
  },
  {
    item: "Q2 retrospective action items",
    source: "notion",
    touches: 5,
    last_touched: daysAgo(4),
    description: "Page updated 5 times, status stuck on 'In Progress' for 9 days",
  },
  {
    item: "Rate limiting discussion",
    source: "slack",
    touches: 4,
    last_touched: daysAgo(1),
    description: "Thread in #engineering — 4 messages from you, no resolution emoji",
  },
  {
    item: "Coral source caching strategy",
    source: "github",
    touches: 6,
    last_touched: daysAgo(3),
    description: "Issue #401 — discussion spans 3 separate sessions, no close event",
  },
];

// ---------------------------------------------------------------------------
// Sources list
// ---------------------------------------------------------------------------
export const mockSources = [
  { name: "google_calendar", connected: true, rows_cached: 47 },
  { name: "github", connected: true, rows_cached: 312 },
  { name: "slack", connected: true, rows_cached: 1840 },
  { name: "notion", connected: false, rows_cached: 0 },
  { name: "discord", connected: true, rows_cached: 205 },
];

// ---------------------------------------------------------------------------
// Morning Briefing (pre-synthesized Claude response for mock mode)
// ---------------------------------------------------------------------------
export const mockBriefing = {
  urgent: [
    {
      item: "Review PR #412 — Coral HTTP source fallback strategy",
      source: "github",
      reason: "Blocking the team release; requested 2h ago on Slack",
    },
    {
      item: "Confirm Coral demo for Friday 3pm",
      source: "slack",
      reason: "Product team awaiting confirmation; demo is in 2 days",
    },
  ],
  waiting_on_you: [
    {
      item: "Rate-limit docs for Discord source manifest",
      source: "discord",
      age_hours: 3,
    },
    {
      item: "search_guild_messages fallback decision (regex vs substring)",
      source: "discord",
      age_hours: 7,
    },
    {
      item: "Q3 roadmap deck review",
      source: "notion",
      age_hours: 24,
    },
  ],
  best_focus_window: "10:00 AM – 11:30 AM (gap between Weekly Eng Sync and your 1:1)",
  summary:
    "You have two time-sensitive items: a PR review blocking a release and a demo confirmation due today. " +
    "Your best uninterrupted focus window is between your morning standup and your 1:1 — use it for deep work on the Coral source spec or PR #412.",
};
