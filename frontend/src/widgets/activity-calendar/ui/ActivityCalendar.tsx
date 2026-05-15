import { useMemo } from "react";
import type { ActivitySummary } from "@/entities/activity/model/types";
import { sportIcon } from "@/shared/lib/sportLabels";
import { MonthCalendar } from "@/shared/ui/MonthCalendar";
import s from "./ActivityCalendar.module.scss";

interface Props {
  summary: ActivitySummary[];
  onDayClick?: (date: string) => void;
}

export function ActivityCalendar({ summary, onDayClick }: Props) {
  const dayMap = useMemo(() => {
    const m = new Map<string, ActivitySummary[]>();
    for (const a of summary) {
      const d = new Date(a.start * 1000).toISOString().slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(a);
    }
    return m;
  }, [summary]);

  return (
    <MonthCalendar
      onDayClick={date => dayMap.has(date) && onDayClick?.(date)}
      renderDay={date => {
        const acts = dayMap.get(date) ?? [];
        if (!acts.length) return { disabled: true };
        return {
          disabled: false,
          children: (
            <div className={s.dots}>
              {acts.slice(0, 3).map((a, j) => (
                <span key={j} className={s.dot}>{sportIcon(a.category)}</span>
              ))}
              {acts.length > 3 && <span className={s.more}>+{acts.length - 3}</span>}
            </div>
          ),
        };
      }}
    />
  );
}
