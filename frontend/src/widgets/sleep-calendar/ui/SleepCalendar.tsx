import { useMemo } from "react";
import type { SleepSummary } from "@/entities/sleep/model/types";
import { fmtSleepDuration } from "@/shared/lib/formatters";
import { MonthCalendar } from "@/shared/ui/MonthCalendar";
import s from "./SleepCalendar.module.scss";

interface Props {
  summary: SleepSummary[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
}

function qualityClass(r: SleepSummary, s: Record<string, string>): string {
  const score = r.score;
  if (score != null) {
    if (score >= 80) return s.good;
    if (score >= 60) return s.ok;
    return s.poor;
  }
  if (r.totalDuration >= 420) return s.good;
  if (r.totalDuration >= 330) return s.ok;
  return s.poor;
}

export function SleepCalendar({ summary, selectedDate, onDayClick }: Props) {
  const dayMap = useMemo(() => {
    const m = new Map<string, SleepSummary>();
    for (const r of summary) {
      const d = new Date(r.bedtime * 1000).toISOString().slice(0, 10);
      if (!m.has(d)) m.set(d, r);
    }
    return m;
  }, [summary]);

  return (
    <>
      <MonthCalendar
        selectedDate={selectedDate}
        onDayClick={onDayClick}
        renderDay={date => {
          const rec = dayMap.get(date);
          if (!rec) return { disabled: true };
          return {
            disabled: false,
            extraClass: qualityClass(rec, s),
            children: <span className={s.dur}>{fmtSleepDuration(rec.totalDuration)}</span>,
          };
        }}
      />
      <div className={s.legend}>
        <span className={s.legendItem}><i className={`${s.dot} ${s.good}`}/>7ч+</span>
        <span className={s.legendItem}><i className={`${s.dot} ${s.ok}`}/>5.5–7ч</span>
        <span className={s.legendItem}><i className={`${s.dot} ${s.poor}`}/>&lt;5.5ч</span>
      </div>
    </>
  );
}
