/**
 * signals.js — Meridian Signal Annotation Engine + Router
 *
 * Endpoints:
 *   GET /api/signals  — returns full briefing data annotated with _signal dots
 *
 * Exports (also used by other modules):
 *   detectSignals(briefingData)      — returns up to 4 proactive signal chips
 *   annotateWithSignals(briefingData) — returns briefingData with _signal on each item
 */

import { Router }    from "express";
import { safeQuery, hoursAgo, daysAgo } from "./shared.js";
import { get as cacheGet, set as cacheSet } from "./cache.js";

export const signalsRouter = Router();

const CACHE_KEY = "signals:annotated";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Signal dot rules (pure logic, no LLM) ────────────────────────────────────

function signalForPR(pr) {
  const updatedHours = hoursAgo(pr.updated_at);
  const state = String(pr.state || "").toLowerCase();
  if (state === "merged" || state === "closed")
    return { status: "green", reason: "PR is merged/closed.", actions: ["View PR"] };
  if (updatedHours > 72)
    return { status: "amber", reason: `Open ${Math.round(updatedHours / 24)} days with no activity.`, actions: ["Assign reviewer", "View PR"] };
  if (updatedHours < 2)
    return { status: "blue",  reason: "Recent activity in the last 2 hours.", actions: ["View PR"] };
  return { status: "green", reason: "Active, no blockers.", actions: ["View PR"] };
}

function signalForCalendarEvent(ev) {
  const start = new Date(String(ev.start_date_time || ev.start_date || ev.start || "").replace(/Z$/, ""));
  const minsUntil = isNaN(start) ? Infinity : (start - Date.now()) / 60_000;
  if (minsUntil > 0 && minsUntil <= 30)
    return { status: "red",   reason: `Starting in ${Math.round(minsUntil)} minutes.`, actions: ["View agenda"] };
  if (minsUntil > 0 && minsUntil <= 120)
    return { status: "amber", reason: `Starting in ${Math.round(minsUntil / 60 * 10) / 10} hours.`, actions: ["Prep notes"] };
  if (!ev.description && minsUntil > 0 && minsUntil <= 240)
    return { status: "amber", reason: "No agenda set for upcoming meeting.", actions: ["Draft agenda"] };
  return { status: "green", reason: "No immediate action needed.", actions: [] };
}

function signalForEmail(msg) {
  const age = hoursAgo(msg.internal_date ? new Date(Number(msg.internal_date)) : msg.date);
  const labelIds = String(msg.label_ids || msg.labels || "");
  const isUnread  = labelIds.includes("UNREAD");
  const snippet   = String(msg.snippet || msg.subject || "");
  const isUrgent  = /urgent|asap|deadline|action required|critical/i.test(snippet);

  if (isUnread && isUrgent)
    return { status: "red",   reason: "Unread message with urgent keywords.", actions: ["Reply now", "View message"] };
  if (isUnread && age > 48)
    return { status: "red",   reason: `Unread for ${Math.round(age / 24)} days.`, actions: ["Reply", "View message"] };
  if (isUnread)
    return { status: "blue",  reason: "Unread message awaiting review.", actions: ["View message"] };
  return { status: "green", reason: "Read, no action needed.", actions: [] };
}

function signalForNotionPage(page) {
  const editedDays = daysAgo(page.last_edited_time || page.updated_at);
  const due = page.due_date || page.due;
  const status = String(page.status || "").toLowerCase();
  const today = new Date().toISOString().split("T")[0];

  if (due && due < today && !status.includes("done") && !status.includes("complete"))
    return { status: "red",   reason: `Task is overdue (due ${due}).`, actions: ["Start task", "Update status"] };
  if (editedDays > 7)
    return { status: "amber", reason: `Not edited for ${Math.round(editedDays)} days.`, actions: ["Review page", "Archive?"] };
  if (editedDays < 0.1)
    return { status: "blue",  reason: "Edited in the last 6 hours.", actions: ["View page"] };
  return { status: "green", reason: "Recently active.", actions: ["View page"] };
}

function signalForSlackMessage(msg) {
  const age = hoursAgo(msg.ts ? new Date(Number(msg.ts) * 1000) : msg.timestamp);
  const text = String(msg.text || msg.content || "");
  const isMention = /<@[A-Z0-9]+>|@here|@channel/i.test(text);

  if (isMention && age > 12)
    return { status: "red",   reason: `Unanswered mention for ${Math.round(age)} hours.`, actions: ["Reply now", "Open thread"] };
  if (isMention)
    return { status: "blue",  reason: "You were mentioned.", actions: ["View mention"] };
  if (age < 2)
    return { status: "blue",  reason: "New message in last 2 hours.", actions: ["View message"] };
  return { status: "green", reason: "No action needed.", actions: [] };
}

// ── Main annotator ────────────────────────────────────────────────────────────

export function annotateWithSignals(briefingData) {
  const annotated = { ...briefingData };

  if (annotated.calendar?.rows)
    annotated.calendar.rows = annotated.calendar.rows.map(ev => ({ ...ev, _signal: signalForCalendarEvent(ev) }));

  if (annotated.gmail_inbox?.rows)
    annotated.gmail_inbox.rows = annotated.gmail_inbox.rows.map(m => ({ ...m, _signal: signalForEmail(m) }));

  if (annotated.notion_search?.rows)
    annotated.notion_search.rows = annotated.notion_search.rows.map(p => ({ ...p, _signal: signalForNotionPage(p) }));

  if (annotated.github_pulls?.rows)
    annotated.github_pulls.rows = annotated.github_pulls.rows.map(pr => ({ ...pr, _signal: signalForPR(pr) }));

  if (annotated.github_issues?.rows)
    annotated.github_issues.rows = annotated.github_issues.rows.map(pr => ({ ...pr, _signal: signalForPR(pr) }));

  if (annotated.slack_channels?.rows)
    annotated.slack_channels.rows = annotated.slack_channels.rows.map(m => ({ ...m, _signal: signalForSlackMessage(m) }));

  if (annotated.discord?.rows)
    annotated.discord.rows = annotated.discord.rows.map(m => ({ ...m, _signal: signalForSlackMessage(m) }));

  return annotated;
}

// ── GET /api/signals ─────────────────────────────────────────────────────────
signalsRouter.get("/", async (req, res) => {
  try {
    const cached = cacheGet(CACHE_KEY);
    if (cached) return res.json(cached);

    // Lightweight snapshot for annotation
    const [calendar, gmailInbox, githubPulls, slackChannels, notionSearch] = await Promise.all([
      safeQuery("SELECT summary, start, end, description FROM google_calendar.events LIMIT 10", "calendar"),
      safeQuery("SELECT id, thread_id, snippet, label_ids, internal_date FROM gmail.messages WHERE label_ids = 'INBOX' LIMIT 20", "gmail_inbox"),
      safeQuery("SELECT number, title, state, updated_at, user__login FROM github.pulls WHERE owner = 'GaneshBamalwa' AND repo = 'coralHackathon' LIMIT 20", "github_pulls"),
      safeQuery("SELECT id, name, num_members FROM slack.channels LIMIT 20", "slack_channels"),
      safeQuery("SELECT id, object, last_edited_time, url FROM notion.search LIMIT 20", "notion_search"),
    ]);

    const raw = { calendar, gmail_inbox: gmailInbox, github_pulls: githubPulls, slack_channels: slackChannels, notion_search: notionSearch };
    const result = annotateWithSignals(raw);

    cacheSet(CACHE_KEY, result, CACHE_TTL);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Signal annotation failed", _partial: true });
  }
});

// ── detectSignals (re-export for /api/briefing compatibility) ─────────────────
const URGENT_KEYWORDS = /urgent|asap|deadline|action required|important|critical|immediately/i;

function minutesFromNow(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(String(dateStr).replace(/Z$/, ""));
  return (d - Date.now()) / 60000;
}

function fmtTime(dateStr) {
  if (!dateStr) return "?";
  const d = new Date(String(dateStr).replace(/Z$/, ""));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDays(n) {
  const r = Math.round(n);
  return r === 1 ? "1 day" : `${r} days`;
}

export function detectSignals(briefingData = {}) {
  const calRows    = briefingData.calendar?.rows      || [];
  const gmailRows  = briefingData.gmail_inbox?.rows   || briefingData.gmail?.rows || [];
  const notionRows = briefingData.notion_search?.rows || briefingData.notion?.rows || [];
  const githubPRs  = briefingData.github_pulls?.rows  || briefingData.github?.rows || [];
  const slackRows  = briefingData.slack_channels?.rows || briefingData.slack?.rows || [];
  const discordRows = briefingData.discord?.rows || [];

  const all = [];

  // MEETING_SOON
  for (const ev of calRows) {
    const start = ev.start_date_time || ev.start_date || ev.start;
    const mins = minutesFromNow(start);
    if (mins > 0 && mins <= 120) {
      all.push({ type: "MEETING_SOON", priority: 1, label: `You have "${ev.summary || "a meeting"}" at ${fmtTime(start)}. Want to prep?`, context: { event: ev, minutesUntil: Math.round(mins) } });
      break;
    }
  }

  // BACK_TO_BACK
  const sorted = [...calRows].filter(e => e.start_date_time || e.start_date || e.start)
    .sort((a, b) => new Date(String(a.start_date_time || a.start_date || a.start).replace(/Z$/, "")) - new Date(String(b.start_date_time || b.start_date || b.start).replace(/Z$/, "")));
  for (let i = 0; i < sorted.length - 1; i++) {
    const endA   = new Date(String(sorted[i].end_date_time   || sorted[i].end_date   || sorted[i].end   || "").replace(/Z$/, ""));
    const startB = new Date(String(sorted[i+1].start_date_time || sorted[i+1].start_date || sorted[i+1].start || "").replace(/Z$/, ""));
    const gap = (startB - endA) / 60000;
    if (!isNaN(gap) && gap >= 0 && gap < 15) {
      all.push({ type: "BACK_TO_BACK", priority: 2, label: `Back-to-back: "${sorted[i].summary || "Meeting"}" then "${sorted[i+1].summary || "Meeting"}" with ${Math.round(gap)}min gap. Want a heads-up on both?`, context: { first: sorted[i], second: sorted[i+1], gapMinutes: Math.round(gap) } });
      break;
    }
  }

  // IMPORTANT_UNREAD
  for (const msg of gmailRows) {
    const subject = msg.subject || msg.snippet || "";
    const labelIds = String(msg.label_ids || msg.labels || "");
    if (labelIds.includes("UNREAD") && URGENT_KEYWORDS.test(subject)) {
      all.push({ type: "IMPORTANT_UNREAD", priority: 1, label: `Urgent message: "${String(subject).slice(0, 60)}". Want to see it?`, context: { message: msg } });
      break;
    }
  }

  // OVERDUE_TASK
  const today = new Date().toISOString().split("T")[0];
  for (const task of notionRows) {
    const due = task.due_date || task.due;
    const status = String(task.status || "").toLowerCase();
    if (due && due < today && !status.includes("done") && !status.includes("complete")) {
      all.push({ type: "OVERDUE_TASK", priority: 2, label: `Overdue: "${task.title || task.name || "A task"}" was due ${fmtDays(daysAgo(due))} ago. Want quick pointers?`, context: { task } });
      break;
    }
  }

  // OLD_PR
  for (const pr of githubPRs) {
    if (pr.updated_at && daysAgo(pr.updated_at) > 3 && String(pr.state || "").toLowerCase() === "open") {
      all.push({ type: "OLD_PR", priority: 3, label: `PR "${pr.title || `#${pr.number}`}" open ${fmtDays(daysAgo(pr.updated_at))} with no activity. Draft a nudge?`, context: { pr } });
      break;
    }
  }

  // UNREAD_MENTION
  for (const msg of [...slackRows, ...discordRows]) {
    const text = String(msg.text || msg.content || "");
    if (/<@[A-Z0-9!?0-9]+>|@here|@channel|@everyone/i.test(text)) {
      const user = msg.username || msg.author__username || "someone";
      all.push({ type: "UNREAD_MENTION", priority: 2, label: `You were mentioned by ${user}. Want to see it?`, context: { message: msg } });
      break;
    }
  }

  // STALE_PAGE
  for (const page of notionRows) {
    if (daysAgo(page.last_edited_time || page.updated_at) > 7) {
      all.push({ type: "STALE_PAGE", priority: 4, label: `"${page.title || page.name || "A page"}" hasn't been touched in ${fmtDays(daysAgo(page.last_edited_time || page.updated_at))}. Still relevant?`, context: { page } });
      break;
    }
  }

  const seen = new Set();
  return all
    .sort((a, b) => a.priority - b.priority)
    .filter(s => { if (seen.has(s.type)) return false; seen.add(s.type); return true; })
    .slice(0, 4);
}
