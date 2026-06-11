import { useEffect, useState } from "react";
import css from "./TodayTab.module.css";
import { coralApiUrl } from "../../lib/coralApi";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "?";
  const d = new Date(String(iso).replace(/Z$/, ""));
  return isNaN(d) ? "?" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(start, end) {
  if (!start || !end) return "";
  const mins = (new Date(String(end).replace(/Z$/, "")) - new Date(String(start).replace(/Z$/, ""))) / 60000;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.round(mins / 6) / 10}h`;
}

function useFetch(url, opts = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchFn = opts.method === "POST"
      ? fetch(coralApiUrl(url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts.body) })
      : fetch(coralApiUrl(url));

    fetchFn
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, loading, error };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QueueItem({ item, urgency }) {
  const color = urgency === "high" ? "#E53E3E" : "#DD6B20";
  return (
    <li className={css.queueItem}>
      <span className={css.urgencyDot} style={{ background: color }} />
      <span className={css.queueLabel}>{item.label}</span>
      <span className={css.queueAge}>{item.age}</span>
      <button className={css.queueAction}>
        {item.source === "github" ? "Review" : item.source === "gmail" ? "Reply" : "View"}
      </button>
    </li>
  );
}

function CalendarList({ events, briefingData }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const todayEvents = (events || [])
    .filter(ev => {
      const s = ev.start_date_time || ev.start_date || ev.start || "";
      return String(s).startsWith(todayStr);
    })
    .sort((a, b) => {
      const aS = a.start_date_time || a.start_date || a.start || "";
      const bS = b.start_date_time || b.start_date || b.start || "";
      return new Date(aS) - new Date(bS);
    });

  if (todayEvents.length === 0) return <p className={css.empty}>No events today</p>;
  return (
    <ul className={css.colList}>
      {todayEvents.map((ev, i) => {
        const s = ev.start_date_time || ev.start_date || ev.start;
        const e = ev.end_date_time   || ev.end_date   || ev.end;
        return (
          <li key={i} className={css.calItem}>
            <span className={css.calTime}>{fmtTime(s)}</span>
            <span className={css.calSummary}>{ev.summary || "Event"}</span>
            <span className={css.calDuration}>{fmtDuration(s, e)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Morning Mode ─────────────────────────────────────────────────────────────
function MorningLayout({ timeCtx, briefing, pressure }) {
  const calRows  = briefing?.sources?.calendar?.rows || [];
  const waiting  = [
    ...(pressure?.matrix?.highUrgencyWaitingOnYou || []).map(i => ({ ...i, urgency: "high" })),
    ...(pressure?.matrix?.lowUrgencyWaitingOnYou  || []).map(i => ({ ...i, urgency: "low" })),
  ].slice(0, 8);
  const mustClose = (pressure?.matrix?.highUrgencyWaitingOnYou || [])
    .filter(i => i.age && i.age.includes("d")).slice(0, 5);

  const fw = timeCtx?.bestFocusWindow;
  const fwLabel = fw
    ? `${fmtTime(fw.start)} – ${fmtTime(fw.end)} (${Math.round(fw.durationMinutes / 60 * 10) / 10}h)`
    : "No window found";

  return (
    <>
      {/* Daily signal */}
      <div className={css.greetingCard}>
        <div className={css.greetingTop}>
          <span className={css.greetingName}>TODAY'S SIGNAL</span>
          <button className={css.queueAction} style={{ padding: "3px 10px", fontSize: 11 }}>
            Export to Cal
          </button>
        </div>
        {briefing?.briefing?.watchOut?.[0] && (
          <div className={css.signalRow}>
            <span className={css.signalIcon}>⚡</span>
            <span className={css.signalLabel}>Main risk</span>
            <span className={css.signalValue}>{briefing.briefing.watchOut[0]}</span>
          </div>
        )}
        {briefing?.briefing?.beforeYouStart?.length > 0 && (
          <div className={css.signalRow}>
            <span className={css.signalIcon}>📋</span>
            <span className={css.signalLabel}>Must-do</span>
            <span className={css.signalValue}>
              {(Array.isArray(briefing.briefing.beforeYouStart)
                ? briefing.briefing.beforeYouStart
                : [briefing.briefing.beforeYouStart]).slice(0, 3).join(" · ")}
            </span>
          </div>
        )}
        <div className={css.signalRow}>
          <span className={css.signalIcon}>📅</span>
          <span className={css.signalLabel}>Calendar</span>
          <span className={css.signalValue}>{calRows.length} event{calRows.length !== 1 ? "s" : ""} today</span>
        </div>
        <div className={css.signalRow}>
          <span className={css.signalIcon}>🔵</span>
          <span className={css.signalLabel}>Best window</span>
          <span className={css.signalValue}>{fwLabel}</span>
        </div>
      </div>

      {/* 3 columns */}
      <div className={css.grid3}>
        {/* Waiting on you */}
        <div className={css.col}>
          <div className={css.colHeader}>
            <span className={css.colTitle}>Waiting on you</span>
            {waiting.length > 0 && <span className={css.colBadge}>{waiting.length}</span>}
          </div>
          <ul className={css.colList}>
            {waiting.length === 0
              ? <li><p className={css.empty}>nothing waiting on you</p></li>
              : waiting.map((item, i) => <QueueItem key={i} item={item} urgency={item.urgency} />)
            }
          </ul>
        </div>

        {/* Calendar */}
        <div className={css.col}>
          <div className={css.colHeader}>
            <span className={css.colTitle}>Today's Calendar</span>
          </div>
          <CalendarList events={calRows} />
        </div>

        {/* Must close */}
        <div className={css.col}>
          <div className={css.colHeader}>
            <span className={css.colTitle}>Must close today</span>
            {mustClose.length > 0 && <span className={css.colBadge}>{mustClose.length}</span>}
          </div>
          <ul className={css.colList}>
            {mustClose.length === 0
              ? <li><p className={css.empty}>all clear</p></li>
              : mustClose.map((item, i) => <QueueItem key={i} item={item} urgency="high" />)
            }
          </ul>
        </div>
      </div>
    </>
  );
}

// ── Workday Mode ──────────────────────────────────────────────────────────────
function WorkdayLayout({ timeCtx, briefing, pressure }) {
  const oneThing   = briefing?.briefing?.oneThing;
  const switches   = timeCtx?.contextSwitches || 0;

  return (
    <>
      {/* Now/Next banner */}
      {(timeCtx?.currentEvent || timeCtx?.nextEvent) && (
        <div className={css.nowBanner}>
          {timeCtx.currentEvent && (
            <>
              <p className={css.nowLabel}>Now</p>
              <p className={css.nowTitle}>{timeCtx.currentEvent.summary}</p>
              <p className={css.nextLabel}>ends {fmtTime(timeCtx.currentEvent.end)}</p>
            </>
          )}
          {timeCtx.nextEvent && (
            <p className={css.nextLabel} style={{ marginTop: timeCtx.currentEvent ? 8 : 0 }}>
              Next: {timeCtx.nextEvent.summary} at {fmtTime(timeCtx.nextEvent.start)}
            </p>
          )}
        </div>
      )}

      <div className={css.grid3} style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Current context */}
        <div className={css.col}>
          <div className={css.colHeader}><span className={css.colTitle}>Current Context</span></div>
          <div style={{ padding: "10px 12px" }}>
            {oneThing
              ? <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{oneThing}</p>
              : <p className={css.empty}>no focus item set</p>
            }
            {briefing?.signals?.[0] && (
              <p style={{ fontSize: 11, color: "#475569", marginTop: 8, lineHeight: 1.4 }}>
                Signal: {briefing.signals[0].label}
              </p>
            )}
          </div>
        </div>

        {/* Interruption cost */}
        <div className={css.col}>
          <div className={css.colHeader}><span className={css.colTitle}>Interruption Cost</span></div>
          <div style={{ padding: "10px 12px" }}>
            <p style={{ fontSize: 24, fontFamily: "JetBrains Mono", fontWeight: 700, color: "#e2e8f0" }}>
              {switches}
            </p>
            <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.4, marginTop: 4 }}>
              context switches today
              {switches > 0 ? ` — avg session ${Math.round(480 / Math.max(switches, 1))} min` : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Evening Mode ──────────────────────────────────────────────────────────────
function EveningLayout({ timeCtx, briefing, pressure }) {
  const [tomorrowPlan, setTomorrowPlan] = useState(null);
  const [loadingPlan,  setLoadingPlan]  = useState(false);
  const [exportMsg,    setExportMsg]    = useState(null);

  const signals = briefing?.signals || [];
  const completed  = signals.filter(s => s.context?.event?._signal?.status === "green" || s.context?.pr?._signal?.status === "green");
  const incomplete = signals.filter(s => ["red", "amber"].includes(s.context?.event?._signal?.status || s.context?.pr?._signal?.status));

  useEffect(() => {
    setLoadingPlan(true);
    fetch(coralApiUrl("/api/lens/query"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "What should I set up for tomorrow based on today's incomplete items?",
        context: { mode: "evening", pressure, signals },
      }),
    })
      .then(r => r.json())
      .then(d => setTomorrowPlan(d))
      .catch(() => setTomorrowPlan({ type: "text", content: "Unable to generate plan." }))
      .finally(() => setLoadingPlan(false));
  }, []);

  const handleExport = async () => {
    const content = tomorrowPlan?.content || "";
    try {
      const res  = await fetch(coralApiUrl("/api/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "notion", payload: { content } }),
      });
      const json = await res.json();
      setExportMsg(json.message || (json.success ? "Exported!" : "Export failed."));
    } catch {
      setExportMsg("Couldn't reach backend.");
    }
  };

  const planContent = tomorrowPlan?.content;

  return (
    <>
      {/* Completed */}
      <div className={css.retroSection}>
        <p className={css.retroTitle}>✓ Completed today</p>
        {completed.length === 0
          ? <p className={css.empty}>No resolved items detected</p>
          : completed.slice(0, 5).map((s, i) => (
            <div key={i} className={css.retroItem}>
              <span style={{ color: "#38A169" }}>●</span>
              <span>{s.label}</span>
            </div>
          ))
        }
      </div>

      {/* Incomplete */}
      <div className={css.retroSection}>
        <p className={css.retroTitle}>⏳ Left incomplete</p>
        {incomplete.length === 0
          ? <p className={css.empty}>Nothing unresolved</p>
          : incomplete.slice(0, 5).map((s, i) => (
            <div key={i} className={css.retroItem}>
              <span style={{ color: "#DD6B20" }}>●</span>
              <span>{s.label}</span>
            </div>
          ))
        }
      </div>

      {/* Tomorrow plan */}
      <div className={css.retroSection}>
        <p className={css.retroTitle}>Tomorrow Setup</p>
        {loadingPlan
          ? <div className={css.skeleton} />
          : planContent
          ? Array.isArray(planContent)
            ? <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
                {planContent.map((item, i) => (
                  <div key={i} className={css.retroItem}>
                    <span style={{ color: "#3182CE" }}>→</span>
                    <span>{item}</span>
                  </div>
                ))}
              </ul>
            : <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{planContent}</p>
          : <p className={css.empty}>No plan generated</p>
        }
        <button className={css.exportBtn} style={{ marginTop: 12 }} onClick={handleExport}>
          Export tomorrow's plan to Notion
        </button>
        {exportMsg && <p className={css.exportMsg}>{exportMsg}</p>}
      </div>
    </>
  );
}

// ── Greeting header ───────────────────────────────────────────────────────────
function GreetingHeader({ timeCtx }) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const score   = timeCtx?.focusScore ?? null;

  return (
    <div className={css.greetingCard}>
      <div className={css.greetingTop}>
        <span className={css.greetingName}>{timeCtx?.greeting || "Welcome"}</span>
        <span className={css.greetingMeta}>{dateStr}</span>
        {score !== null && (
          <span className={css.focusScore}>Focus {score}%</span>
        )}
      </div>
      <div className={css.divider} />
      <p style={{ fontSize: 11, color: "#475569", fontFamily: "JetBrains Mono, monospace" }}>
        {timeCtx?.mode === "morning"  && "Morning briefing mode"}
        {timeCtx?.mode === "workday"  && "Active work session"}
        {timeCtx?.mode === "evening"  && "Evening retrospective"}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TodayTab() {
  const { data: timeCtx,  loading: loadingTime }     = useFetch("/api/timecontext");
  const { data: briefing, loading: loadingBriefing } = useFetch("/api/briefing");
  const { data: pressure, loading: loadingPressure } = useFetch("/api/pressure");

  const loading = loadingTime || loadingBriefing || loadingPressure;
  const mode    = timeCtx?.mode || "workday";

  return (
    <div className={css.root}>
      {loading
        ? [1,2,3].map(i => <div key={i} className={css.skeleton} style={{ height: 60 + i * 20 }} />)
        : (
          <>
            <GreetingHeader timeCtx={timeCtx} />
            {mode === "morning" && <MorningLayout timeCtx={timeCtx} briefing={briefing} pressure={pressure} />}
            {mode === "workday" && <WorkdayLayout timeCtx={timeCtx} briefing={briefing} pressure={pressure} />}
            {mode === "evening" && <EveningLayout timeCtx={timeCtx} briefing={briefing} pressure={pressure} />}
          </>
        )
      }
    </div>
  );
}
