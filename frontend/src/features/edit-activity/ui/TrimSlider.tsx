import { useRef, useCallback } from "react";
import s from "./TrimSlider.module.scss";

interface Props {
  totalSec: number;   // total original duration in seconds
  startOff: number;   // current left offset from original start (seconds)
  endOff: number;     // current right offset from original end (seconds, ≤ 0)
  onChange: (startOff: number, endOff: number) => void;
}

function fmtOffset(sec: number, side: "start" | "end"): string {
  const abs = Math.abs(sec);
  if (abs === 0) return side === "start" ? "начало" : "конец";
  const m = Math.floor(abs / 60);
  const s2 = abs % 60;
  const t = m > 0 ? `${m} мин ${s2} с` : `${s2} с`;
  return side === "start" ? `+${t}` : `−${t}`;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s2 = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
  return `${m}:${String(s2).padStart(2, "0")}`;
}

const MIN_DURATION_S = 60;

export function TrimSlider({ totalSec, startOff, endOff, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  // startOff ∈ [0, totalSec - MIN)
  // endOff   ∈ [-(totalSec - MIN), 0]
  // effective duration = totalSec - startOff + endOff
  const leftPct  = (startOff / totalSec) * 100;
  const rightPct = ((-endOff) / totalSec) * 100;
  const duration = totalSec - startOff + endOff;

  const pctToSec = useCallback((pct: number) => Math.round((pct / 100) * totalSec), [totalSec]);

  const startDrag = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    handle: "left" | "right",
  ) => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;

    const move = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const raw = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const sec = pctToSec(raw * 100);

      if (handle === "left") {
        const maxStart = totalSec + endOff - MIN_DURATION_S;
        onChange(Math.min(sec, maxStart), endOff);
      } else {
        const minEnd = startOff + MIN_DURATION_S - totalSec;
        onChange(startOff, Math.max(sec - totalSec, minEnd));
      }
    };

    const onMouseMove = (ev: MouseEvent) => move(ev.clientX);
    const onTouchMove = (ev: TouchEvent) => move(ev.touches[0].clientX);
    const stop = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", stop);
  }, [totalSec, startOff, endOff, onChange, pctToSec]);

  const trimmed = startOff !== 0 || endOff !== 0;

  return (
    <div className={s.wrap}>
      <div className={s.track} ref={trackRef}>
        {/* inactive zones */}
        <div className={s.inactive} style={{ left: 0, width: `${leftPct}%` }} />
        <div className={s.inactive} style={{ right: 0, width: `${rightPct}%` }} />

        {/* active zone */}
        <div
          className={s.active}
          style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
        />

        {/* left handle */}
        <div
          className={`${s.handle} ${s.handleLeft}`}
          style={{ left: `${leftPct}%` }}
          onMouseDown={(e) => startDrag(e, "left")}
          onTouchStart={(e) => startDrag(e, "left")}
        >
          {startOff !== 0 && <div className={s.tooltip}>{fmtOffset(startOff, "start")}</div>}
        </div>

        {/* right handle */}
        <div
          className={`${s.handle} ${s.handleRight}`}
          style={{ right: `${rightPct}%` }}
          onMouseDown={(e) => startDrag(e, "right")}
          onTouchStart={(e) => startDrag(e, "right")}
        >
          {endOff !== 0 && <div className={s.tooltip}>{fmtOffset(endOff, "end")}</div>}
        </div>
      </div>

      <div className={s.footer}>
        <span className={s.durationLabel}>
          {trimmed ? (
            <>
              <span className={s.durationNew}>{fmtDuration(duration)}</span>
              <span className={s.durationOrig}> (было {fmtDuration(totalSec)})</span>
            </>
          ) : (
            <span className={s.durationOrig}>{fmtDuration(totalSec)}</span>
          )}
        </span>
        {trimmed && (
          <button
            type="button"
            className={s.resetBtn}
            onClick={() => onChange(0, 0)}
          >
            сбросить
          </button>
        )}
      </div>
    </div>
  );
}
