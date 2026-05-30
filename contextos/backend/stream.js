/**
 * stream.js — Meridian Signal Stream: live cross-source insight card feed
 *
 * Endpoints:
 *   GET    /api/stream        — returns all cards (pinned first, newest first)
 *   POST   /api/stream/:id/pin — toggle pin on a card
 *   DELETE /api/stream/:id    — dismiss (remove) a card
 *
 * Background job (started externally via startStreamJob()):
 *   Runs every 5 minutes. Fetches PRs, Slack, Notion, Calendar.
 *   Finds cross-source correlations by keyword/person. Generates AI insight cards.
 */

import { Router }                        from "express";
import { safeQuery, callGeminiJSON }     from "./shared.js";
import { randomUUID }                    from "crypto";

export const streamRouter = Router();

// ── In-memory card store ──────────────────────────────────────────────────────
let cards = [];   // max 20 cards

function addCard(card) {
  cards.unshift({ ...card, id: randomUUID(), createdAt: new Date(), pinned: false, expired: false });
  if (cards.length > 20) cards = cards.slice(0, 20);
}

function ageLabel(date) {
  const mins = (Date.now() - new Date(date)) / 60000;
  if (mins < 60)   return `${Math.round(mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

// ── Keyword extraction ────────────────────────────────────────────────────────
function extractKeywords(text = "") {
  return String(text).toLowerCase()
    .match(/\b([a-z][a-z0-9_-]{3,})\b/g)
    ?.filter(w => !["from","that","this","with","have","been","your","they","will","were","are","for","the","and"].includes(w)) || [];
}

function findClusters(allItems) {
  const clusters = [];
  const wordMap  = new Map();

  for (const item of allItems) {
    const text = JSON.stringify(item).toLowerCase();
    const kws  = extractKeywords(text);
    for (const kw of kws) {
      if (!wordMap.has(kw)) wordMap.set(kw, []);
      wordMap.get(kw).push(item);
    }
  }

  for (const [kw, items] of wordMap) {
    const deduped = [...new Set(items)];
    if (deduped.length >= 2) {
      const sources = [...new Set(deduped.map(i => i._source))];
      if (sources.length >= 2) {  // only cross-source clusters
        clusters.push({ keyword: kw, items: deduped.slice(0, 5), sources });
      }
    }
  }

  // Sort by size desc, deduplicate heavily overlapping clusters
  const seen = new Set();
  return clusters
    .sort((a, b) => b.items.length - a.items.length)
    .filter(c => {
      const key = c.items.map(i => i._id).sort().join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

// ── Stream correlation pass ───────────────────────────────────────────────────
export async function runStreamPass() {
  try {
    const [prs, slack, notion, calendar] = await Promise.all([
      safeQuery("SELECT number, title, state, updated_at, user__login FROM github.pulls WHERE owner = 'GaneshBamalwa' AND repo = 'coralHackathon' LIMIT 20", "github"),
      safeQuery("SELECT id, name, num_members FROM slack.channels LIMIT 20", "slack"),
      safeQuery("SELECT id, object, last_edited_time, url FROM notion.search LIMIT 20", "notion"),
      safeQuery("SELECT summary, start, end, description FROM google_calendar.events LIMIT 10", "calendar"),
    ]);

    const allItems = [
      ...prs.rows.map(r     => ({ ...r, _source: "github",   _id: `gh-${r.number}`,  _label: r.title   })),
      ...slack.rows.map(r   => ({ ...r, _source: "slack",    _id: `sl-${r.id}`,      _label: r.name    })),
      ...notion.rows.map(r  => ({ ...r, _source: "notion",   _id: `no-${r.id}`,      _label: r.id      })),
      ...calendar.rows.map(r=> ({ ...r, _source: "calendar", _id: `cal-${r.summary}`,_label: r.summary })),
    ];

    const clusters = findClusters(allItems);

    for (const cluster of clusters.slice(0, 3)) {
      try {
        const result = await callGeminiJSON(`Given these related items from multiple sources, write a 2-3 sentence insight card for a developer dashboard. Be specific. Surface what's blocking, stale, or needs attention. End with 1-2 action labels (short, verb-first).

Items: ${JSON.stringify(cluster.items.map(i => ({ source: i._source, label: i._label })), null, 2)}

Return ONLY this JSON object — no prose before or after, no markdown fences:
{ "title": string, "body": string, "dotStatus": "red"|"amber"|"blue"|"green", "actions": [{ "label": string, "type": string }] }
Be concise. Return only the JSON object. No prose before or after. No markdown fences.`,
          { temperature: 0.2, maxOutputTokens: 800 }
        );

        addCard({
          title:     result.title     || cluster.keyword,
          age:       "just now",
          dotStatus: result.dotStatus || "amber",
          body:      result.body      || "",
          actions:   result.actions   || [],
          sources:   cluster.sources,
        });
      } catch (e) {
        console.warn("[stream] Card generation failed:", e.message);
      }
    }

    // Mark cards older than 6 hours as expired
    const cutoff = Date.now() - 6 * 3_600_000;
    cards = cards.map(c => ({ ...c, expired: new Date(c.createdAt) < cutoff ? true : c.expired, age: ageLabel(c.createdAt) }));

    console.log(`[stream] Pass complete — ${cards.length} cards in feed`);
  } catch (e) {
    console.warn("[stream] Pass failed:", e.message);
  }
}

export function startStreamJob() {
  runStreamPass();
  return setInterval(runStreamPass, 5 * 60_000);
}

// ── GET / ─────────────────────────────────────────────────────────────────────
streamRouter.get("/", (req, res) => {
  const sorted = [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  res.json({ cards: sorted });
});

// ── POST /:id/pin ─────────────────────────────────────────────────────────────
streamRouter.post("/:id/pin", (req, res) => {
  const card = cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: "Card not found" });
  card.pinned = !card.pinned;
  res.json({ id: card.id, pinned: card.pinned });
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
streamRouter.delete("/:id", (req, res) => {
  const before = cards.length;
  cards = cards.filter(c => c.id !== req.params.id);
  if (cards.length === before) return res.status(404).json({ error: "Card not found" });
  res.json({ success: true });
});
