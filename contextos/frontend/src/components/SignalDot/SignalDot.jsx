import { useState, useRef } from "react";
import { useSignals } from "../../contexts/SignalsContext";
import css from "./SignalDot.module.css";

const STATUS_COLOR = {
  red:   "#E53E3E",
  amber: "#DD6B20",
  blue:  "#3182CE",
  green: "#38A169",
};

const STATUS_LABEL = {
  red:   "Needs action",
  amber: "Stale",
  blue:  "New",
  green: "Resolved",
};

/**
 * SignalDot — renders a 7px coloured dot with hover tooltip.
 * Parent must have position: relative.
 *
 * Props:
 *   itemId  {string}  — id used to look up the _signal via SignalsContext
 *   signal  {object}  — optional: pass _signal directly to skip context lookup
 */
export default function SignalDot({ itemId, signal: signalProp }) {
  const { getSignal } = useSignals();
  const signal = signalProp || (itemId ? getSignal(itemId) : null);

  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef(null);

  if (!signal) return null;

  const color = STATUS_COLOR[signal.status] || "#475569";
  const label = STATUS_LABEL[signal.status] || signal.status;

  const onEnter = () => {
    clearTimeout(leaveTimer.current);
    setHovered(true);
  };
  const onLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 100);
  };

  return (
    <span
      className={css.dot}
      style={{ background: color }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      aria-label={`Signal: ${label}`}
    >
      <span className={`${css.tooltipWrap} ${hovered ? css.visible : ""}`}>
        <span className={css.tooltip}>
          <span className={css.tooltipHeader}>
            <span className={css.dot} style={{ background: color, position: "static", width: 6, height: 6, borderRadius: "50%", display: "inline-block" }} />
            <span className={css.tooltipStatus} style={{ color }}>{label}</span>
          </span>
          <p className={css.tooltipReason}>{signal.reason}</p>
          {signal.actions?.length > 0 && (
            <span className={css.tooltipActions}>
              {signal.actions.map((a, i) => (
                <button key={i} className={css.tooltipAction}>{a}</button>
              ))}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
