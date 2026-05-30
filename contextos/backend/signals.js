/**
 * signals.js — Chief of Staff signal detection engine
 *
 * Takes the structured briefing data object (already-fetched Coral results)
 * and returns an array of up to 4 prioritised signal objects.
 *
 * Each signal: { type, priority, label, context }
 * Does NOT make any new Coral queries — runs purely on already-fetched data.
 */

const NOW = () => new Date();

// ── Helpers ─────────────────────────────────────────────────────────────────

function minutesFromNow(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(String(dateStr).replace(/Z$/, ""));
  return (d - NOW()) / 60000;
}

function hoursAgo(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(String(dateStr).replace(/Z$/, ""));
  return (NOW() - d) / 3600000;
}

function daysAgo(dateStr) {
  return hoursAgo(dateStr) / 24;
}

function fmtTime(dateStr) {
  if (!dateStr) return "unknown time";
  const d = new Date(String(dateStr).replace(/Z$/, ""));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDays(n) {
  const r = Math.round(n);
  return r === 1 ? "1 day" : `${r} days`;
}

const URGENT_KEYWORDS = /urgent|asap|deadline|action required|important|critical|immediately/i;

// ── Detectors ────────────────────────────────────────────────────────────────

/** MEETING_SOON — a meeting starting within the next 2 hours */
function detectMeetingSoon(calendarRows = []) {
  const signals = [];
  for (const ev of calendarRows) {
    const start = ev.start_date_time || ev.start_date || ev.start;
    const mins = minutesFromNow(start);
    if (mins > 0 && mins <= 120) {
      signals.push({
        type: "MEETING_SOON",
        priority: 1,
        label: `You have "${ev.summary || "a meeting"}" at ${fmtTime(start)}. Want to prep?`,
        context: { event: ev, minutesUntil: Math.round(mins) },
      });
    }
  }
  return signals;
}

/** BACK_TO_BACK — two consecutive meetings with < 15 min gap */
function detectBackToBack(calendarRows = []) {
  const signals = [];
  const sorted = [...calendarRows]
    .filter((ev) => ev.start_date_time || ev.start_date || ev.start)
    .sort((a, b) => {
      const aStart = new Date(String(a.start_date_time || a.start_date || a.start).replace(/Z$/, ""));
      const bStart = new Date(String(b.start_date_time || b.start_date || b.start).replace(/Z$/, ""));
      return aStart - bStart;
    });

  for (let i = 0; i < sorted.length - 1; i++) {
    const endA  = new Date(String(sorted[i].end_date_time   || sorted[i].end_date   || sorted[i].end   || "").replace(/Z$/, ""));
    const startB = new Date(String(sorted[i + 1].start_date_time || sorted[i + 1].start_date || sorted[i + 1].start || "").replace(/Z$/, ""));
    const gapMins = (startB - endA) / 60000;
    if (!isNaN(gapMins) && gapMins >= 0 && gapMins < 15) {
      signals.push({
        type: "BACK_TO_BACK",
        priority: 2,
        label: `Back-to-back: "${sorted[i].summary || "Meeting"}" then "${sorted[i + 1].summary || "Meeting"}" with only ${Math.round(gapMins)}min gap. Want a heads-up on both?`,
        context: { first: sorted[i], second: sorted[i + 1], gapMinutes: Math.round(gapMins) },
      });
      break; // surface at most one back-to-back signal
    }
  }
  return signals;
}

/** MEETING_NO_AGENDA — meeting with no description */
function detectMeetingNoAgenda(calendarRows = []) {
  const signals = [];
  for (const ev of calendarRows) {
    const start = ev.start_date_time || ev.start_date || ev.start;
    const mins = minutesFromNow(start);
    // Only flag upcoming meetings (next 4 hours) without a description
    if (mins > 0 && mins <= 240 && !ev.description && ev.summary) {
      signals.push({
        type: "MEETING_NO_AGENDA",
        priority: 3,
        label: `"${ev.summary}" at ${fmtTime(start)} has no agenda. Want to draft one?`,
        context: { event: ev },
      });
      break; // one is enough
    }
  }
  return signals;
}

/** IMPORTANT_UNREAD — unread Gmail message with urgent keywords */
function detectImportantUnread(gmailRows = []) {
  const signals = [];
  for (const msg of gmailRows) {
    const subject  = msg.subject || msg.snippet || "";
    const sender   = msg.from || msg.sender || "someone";
    const labelIds = String(msg.label_ids || msg.labels || "");
    const isUnread = labelIds.includes("UNREAD");
    if (isUnread && URGENT_KEYWORDS.test(subject)) {
      signals.push({
        type: "IMPORTANT_UNREAD",
        priority: 1,
        label: `Urgent message from ${sender}: "${String(subject).slice(0, 60)}". Want to see it?`,
        context: { message: msg },
      });
      break;
    }
  }
  return signals;
}

/** OVERDUE_TASK — Notion task with a past due date */
function detectOverdueTask(notionRows = []) {
  const signals = [];
  const today = new Date().toISOString().split("T")[0];
  for (const task of notionRows) {
    const due    = task.due_date || task.due;
    const status = String(task.status || "").toLowerCase();
    if (due && due < today && !status.includes("done") && !status.includes("complete")) {
      const title = task.title || task.name || "A task";
      signals.push({
        type: "OVERDUE_TASK",
        priority: 2,
        label: `Overdue: "${title}" was due ${fmtDays(daysAgo(due))} ago. Want quick pointers on how to start?`,
        context: { task },
      });
      break; // surface the worst one
    }
  }
  return signals;
}

/** STALE_PAGE — Notion page not touched in > 7 days */
function detectStalePage(notionRows = []) {
  const signals = [];
  for (const page of notionRows) {
    const edited = page.last_edited_time || page.updated_at;
    if (edited && daysAgo(edited) > 7) {
      const title = page.title || page.name || "A page";
      signals.push({
        type: "STALE_PAGE",
        priority: 4,
        label: `"${title}" hasn't been touched in ${fmtDays(daysAgo(edited))}. Still relevant?`,
        context: { page },
      });
      break;
    }
  }
  return signals;
}

/** OLD_PR — open GitHub PR with no activity in > 3 days */
function detectOldPR(githubRows = []) {
  const signals = [];
  for (const pr of githubRows) {
    const updated = pr.updated_at;
    if (updated && daysAgo(updated) > 3 && String(pr.state || "").toLowerCase() === "open") {
      const title = pr.title || `#${pr.number}`;
      signals.push({
        type: "OLD_PR",
        priority: 3,
        label: `PR "${title}" has been open ${fmtDays(daysAgo(updated))} with no activity. Want to draft a nudge?`,
        context: { pr },
      });
      break;
    }
  }
  return signals;
}

/** UNREAD_MENTION — Slack/Discord message mentioning the user */
function detectUnreadMention(slackRows = [], discordRows = []) {
  const signals = [];

  // Slack: look for messages that contain @-mentions in text
  for (const msg of slackRows) {
    const text    = String(msg.text || msg.content || "");
    const channel = msg.channel_name || msg.channel || "a channel";
    const user    = msg.username || msg.user || "someone";
    if (/<@[A-Z0-9]+>/.test(text) || /@here|@channel/i.test(text)) {
      signals.push({
        type: "UNREAD_MENTION",
        priority: 2,
        label: `You were mentioned by ${user} in ${channel}. Want to see it?`,
        context: { message: msg, source: "slack" },
      });
      break;
    }
  }

  // Discord: look for messages that contain @-mentions
  if (signals.length === 0) {
    for (const msg of discordRows) {
      const content = String(msg.content || "");
      const user    = msg.author__username || msg.author || "someone";
      const channel = msg.channel_name || "Discord";
      if (/<@!?[0-9]+>/.test(content) || /@everyone|@here/i.test(content)) {
        signals.push({
          type: "UNREAD_MENTION",
          priority: 2,
          label: `You were mentioned by ${user} in ${channel}. Want to see it?`,
          context: { message: msg, source: "discord" },
        });
        break;
      }
    }
  }

  return signals;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * detectSignals(briefingData) — runs all detectors on already-fetched data.
 * @param {object} briefingData  The `sources` object from /api/briefing
 * @returns {Array}              Up to 4 signal objects sorted by priority
 */
export function detectSignals(briefingData = {}) {
  const calRows    = briefingData.calendar?.rows      || [];
  const gmailRows  = briefingData.gmail_inbox?.rows   || briefingData.gmail?.rows || [];
  const notionRows = briefingData.notion_search?.rows || briefingData.notion?.rows || [];
  const githubPRs  = briefingData.github_pulls?.rows  || briefingData.github?.rows || [];
  const slackRows  = briefingData.slack_channels?.rows || briefingData.slack?.rows || [];
  const discordRows = briefingData.discord?.rows      || [];

  const all = [
    ...detectMeetingSoon(calRows),
    ...detectBackToBack(calRows),
    ...detectMeetingNoAgenda(calRows),
    ...detectImportantUnread(gmailRows),
    ...detectOverdueTask(notionRows),
    ...detectOldPR(githubPRs),
    ...detectUnreadMention(slackRows, discordRows),
    ...detectStalePage(notionRows),
  ];

  // Sort by priority (lower = more urgent), deduplicate by type, cap at 4
  const seen = new Set();
  return all
    .sort((a, b) => a.priority - b.priority)
    .filter((s) => {
      if (seen.has(s.type)) return false;
      seen.add(s.type);
      return true;
    })
    .slice(0, 4);
}
