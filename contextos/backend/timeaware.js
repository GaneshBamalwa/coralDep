/**
 * timeaware.js — Meridian time-of-day context classifier
 *
 * Endpoints:
 *   GET /api/timecontext — returns mode, greeting, focus window, current event, etc.
 *
 * Cache: 1 minute TTL
 */

import { Router }                           from "express";
import { safeQuery }                        from "./shared.js";
import { get as cacheGet, set as cacheSet } from "./cache.js";

export const timeRouter = Router();

const CACHE_KEY = "time:context";
const CACHE_TTL = 60 * 1000; // 1 minute

function getMode(hour) {
  if (hour >= 6  && hour < 10) return "morning";
  if (hour >= 10 && hour < 18) return "workday";
  if (hour >= 18 && hour < 22) return "evening";
  return "workday"; // default outside hours
}

function parseEventTime(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).replace(/Z$/, ""));
  return isNaN(d) ? null : d;
}

function findBestFocusWindow(events, now) {
  const todayStr = now.toISOString().split("T")[0];
  const todayEvents = events
    .map(ev => ({
      start: parseEventTime(ev.start_date_time || ev.start_date || ev.start),
      end:   parseEventTime(ev.end_date_time   || ev.end_date   || ev.end),
      summary: ev.summary,
    }))
    .filter(e => e.start && e.start.toISOString().startsWith(todayStr))
    .sort((a, b) => a.start - b.start);

  if (todayEvents.length === 0) {
    // No events — full day is free, suggest a 2-hour window from now
    const start = new Date(now.getTime() + 5 * 60000); // 5 mins from now
    const end   = new Date(start.getTime() + 120 * 60000);
    return { start: start.toISOString(), end: end.toISOString(), durationMinutes: 120 };
  }

  let bestGap = null;
  let bestDuration = 0;

  // Check gap before first event
  const beforeFirst = (todayEvents[0].start - now) / 60000;
  if (beforeFirst >= 45 && beforeFirst > bestDuration) {
    bestGap = { start: now.toISOString(), end: todayEvents[0].start.toISOString(), durationMinutes: Math.round(beforeFirst) };
    bestDuration = beforeFirst;
  }

  // Check gaps between events
  for (let i = 0; i < todayEvents.length - 1; i++) {
    const gap = (todayEvents[i + 1].start - todayEvents[i].end) / 60000;
    if (gap >= 45 && gap > bestDuration) {
      bestGap = { start: todayEvents[i].end.toISOString(), end: todayEvents[i + 1].start.toISOString(), durationMinutes: Math.round(gap) };
      bestDuration = gap;
    }
  }

  // Check after last event
  const endOfDay = new Date(now); endOfDay.setHours(22, 0, 0, 0);
  const afterLast = (endOfDay - todayEvents[todayEvents.length - 1].end) / 60000;
  if (afterLast >= 45 && afterLast > bestDuration) {
    bestGap = { start: todayEvents[todayEvents.length - 1].end.toISOString(), end: endOfDay.toISOString(), durationMinutes: Math.round(afterLast) };
  }

  return bestGap;
}

timeRouter.get("/", async (req, res) => {
  try {
    const cached = cacheGet(CACHE_KEY);
    if (cached) return res.json(cached);

    const now     = new Date();
    const hour    = now.getHours();
    const mode    = getMode(hour);

    const calResult = await safeQuery(
      "SELECT summary, start, end, description FROM google_calendar.events LIMIT 20",
      "calendar", 10_000
    );
    const events = calResult.rows || [];
    const todayStr = now.toISOString().split("T")[0];

    const todayEvents = events
      .map(ev => ({
        ...ev,
        _start: parseEventTime(ev.start_date_time || ev.start_date || ev.start),
        _end:   parseEventTime(ev.end_date_time   || ev.end_date   || ev.end),
      }))
      .filter(ev => ev._start && ev._start.toISOString().startsWith(todayStr))
      .sort((a, b) => a._start - b._start);

    // Current event = one whose window contains right now
    const currentEvent = todayEvents.find(ev => ev._start <= now && ev._end >= now) || null;
    // Next event = first one that hasn't started yet
    const nextEvent    = todayEvents.find(ev => ev._start > now) || null;

    // Focus score: 100 - 15 per meeting today
    const meetingCount = todayEvents.length;
    const focusScore   = Math.max(0, 100 - meetingCount * 15);

    // Best focus window
    const bestFocusWindow = findBestFocusWindow(events, now);

    // Context switches: how many different source types accessed today (heuristic from events)
    const contextSwitches = Math.min(events.length, 5);

    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const result = {
      mode,
      greeting,
      focusScore,
      currentEvent: currentEvent ? { summary: currentEvent.summary, end: currentEvent._end?.toISOString() } : null,
      nextEvent:    nextEvent    ? { summary: nextEvent.summary,    start: nextEvent._start?.toISOString() } : null,
      bestFocusWindow,
      contextSwitches,
      meetingCount,
      todayEventCount: todayEvents.length,
    };

    cacheSet(CACHE_KEY, result, CACHE_TTL);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message, detail: "Time context failed", _partial: true });
  }
});
