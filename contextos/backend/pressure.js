/**
 * pressure.js — Meridian Pressure Matrix: collaboration health metrics
 *
 * Endpoints:
 *   GET /api/pressure — returns metrics, matrix (urgency × direction), and 14-day timeline
 *
 * Cache: 3 minutes TTL
 */

import { Router }                          from "express";
import { safeQuery, hoursAgo, daysAgo }    from "./shared.js";
import { get as cacheGet, set as cacheSet} from "./cache.js";

export const pressureRouter = Router();

const CACHE_KEY = "pressure:matrix";
const CACHE_TTL = 3 * 60 * 1000;

function ageLabel(dateStr) {
  const h = hoursAgo(dateStr);
  if (h < 1)   return "< 1h ago";
  if (h < 24)  return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function isHighUrgency(item, ageHours) {
  return ageHours > 24 || (item._signal?.status === "red");
}

pressureRouter.get("/", async (req, res) => {
  try {
    const cached = cacheGet(CACHE_KEY);
    if (cached) return res.json(cached);

    const [prs, gmailRows, slackRows] = await Promise.all([
      safeQuery("SELECT number, title, state, updated_at, user__login FROM github.pulls WHERE owner = 'GaneshBamalwa' AND repo = 'coralHackathon' LIMIT 50", "github"),
      safeQuery("SELECT id, snippet, label_ids, internal_date FROM gmail.messages WHERE label_ids = 'INBOX' LIMIT 50", "gmail"),
      safeQuery("SELECT id, name, num_members FROM slack.channels LIMIT 30", "slack"),
    ]);

    const openPRs    = prs.rows.filter(pr => String(pr.state || "").toLowerCase() === "open");
    const stalePRs   = openPRs.filter(pr => hoursAgo(pr.updated_at) > 24);
    const unreadMsgs = gmailRows.rows.filter(m => String(m.label_ids || "").includes("UNREAD"));

    // Waiting on you = open PR where you haven't recently acted + unread emails
    const waitingOnYou = stalePRs.length + unreadMsgs.length;

    // Average response time heuristic (based on PR update gaps)
    const avgResponseTimeHours = openPRs.length > 0
      ? openPRs.reduce((sum, pr) => sum + hoursAgo(pr.updated_at), 0) / openPRs.length
      : 0;

    // Build matrix items
    const highWaitingOnYou  = [];
    const lowWaitingOnYou   = [];
    const highWaitingOnThem = [];
    const lowWaitingOnThem  = [];

    for (const pr of openPRs) {
      const age = hoursAgo(pr.updated_at);
      const item = {
        label:  `PR #${pr.number}: ${String(pr.title || "").slice(0, 50)}`,
        source: "github",
        age:    ageLabel(pr.updated_at),
        id:     String(pr.number),
      };
      // PRs you haven't reviewed = waiting on you; PRs you opened = waiting on them
      const isYourPR = String(pr.user__login || "").toLowerCase() === "ganeshbamalwa";
      if (isYourPR) {
        isHighUrgency(pr, age) ? highWaitingOnThem.push(item) : lowWaitingOnThem.push(item);
      } else {
        isHighUrgency(pr, age) ? highWaitingOnYou.push(item)  : lowWaitingOnYou.push(item);
      }
    }

    for (const msg of unreadMsgs) {
      const age  = hoursAgo(msg.internal_date ? new Date(Number(msg.internal_date)) : null);
      const item = {
        label:  String(msg.snippet || msg.id || "Email").slice(0, 60),
        source: "gmail",
        age:    ageLabel(msg.internal_date ? new Date(Number(msg.internal_date)) : null),
        id:     String(msg.id),
      };
      isHighUrgency(msg, age) ? highWaitingOnYou.push(item) : lowWaitingOnYou.push(item);
    }

    // 14-day timeline (heuristic from PR update_at dates)
    const timelineMap = {};
    for (const pr of prs.rows) {
      const d = pr.updated_at ? new Date(pr.updated_at).toISOString().split("T")[0] : null;
      if (!d) continue;
      if (!timelineMap[d]) timelineMap[d] = { date: d, totalHours: 0, count: 0, source: "github" };
      timelineMap[d].totalHours += hoursAgo(pr.updated_at);
      timelineMap[d].count++;
    }
    const timeline = Object.values(timelineMap)
      .map(t => ({ date: t.date, avgResponseHours: Math.round(t.totalHours / t.count * 10) / 10, source: t.source }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const result = {
      metrics: {
        waitingOnYou,
        stalePRs:            stalePRs.length,
        unansweredMentions:  unreadMsgs.length,
        avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
      },
      matrix: {
        highUrgencyWaitingOnYou:  highWaitingOnYou.slice(0, 10),
        lowUrgencyWaitingOnYou:   lowWaitingOnYou.slice(0, 10),
        highUrgencyWaitingOnThem: highWaitingOnThem.slice(0, 10),
        lowUrgencyWaitingOnThem:  lowWaitingOnThem.slice(0, 10),
      },
      timeline,
      _partial: prs.timedOut || gmailRows.timedOut || slackRows.timedOut || false,
    };

    cacheSet(CACHE_KEY, result, CACHE_TTL);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Pressure matrix failed", _partial: true });
  }
});
