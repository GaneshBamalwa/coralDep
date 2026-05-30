import { useState } from "react";
import { Zap, ChevronUp } from "lucide-react";
import { usePulse } from "../../hooks/usePulse";
import css from "./PulseBar.module.css";

export default function PulseBar() {
  const { sentence, loading, error, elaborate, elaborating, elaboration, refetchNow } = usePulse();
  const [open, setOpen] = useState(false);

  const handleBarClick = () => {
    if (!open) {
      setOpen(true);
      elaborate();
    } else {
      setOpen(false);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setOpen(false);
    refetchNow();
  };

  const displayText = loading
    ? "loading signal…"
    : error
    ? "signal unavailable"
    : sentence || "no signal";

  return (
    <>
      {/* Slide-up drawer */}
      <div className={`${css.drawerWrap} ${open ? css.drawerOpen : ""}`}>
        {elaborating ? (
          <p className={css.thinking}>Elaborating…</p>
        ) : elaboration?.error ? (
          <p className={css.thinking}>Couldn't reach backend — {elaboration.error}</p>
        ) : elaboration ? (
          <>
            <p className={css.drawerTitle}>Signal Detail</p>
            <p className={css.elaborationText}>{elaboration.elaboration}</p>
            <div className={css.actions}>
              {(elaboration.actions || []).map((act, i) => (
                <button
                  key={i}
                  className={css.actionBtn}
                  onClick={() => console.log("[pulse action]", act.type, act.label)}
                >
                  {act.label}
                </button>
              ))}
              <button className={css.nextBtn} onClick={handleNext}>
                Next signal →
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Fixed bar */}
      <div className={css.bar} onClick={handleBarClick} title="Click to expand insight">
        <Zap size={11} className={css.icon} />
        <span className={`${css.sentence} ${loading ? css.sentenceHidden : css.sentenceVisible}`}>
          {displayText}
        </span>
        <ChevronUp
          size={11}
          className={css.hint}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
        />
        <span className={css.hint}>{open ? "collapse" : "expand"}</span>
      </div>
    </>
  );
}
