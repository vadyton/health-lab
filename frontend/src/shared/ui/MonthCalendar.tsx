import { useMemo, useState, type ReactNode } from "react";
import s from "./MonthCalendar.module.scss";

const MONTHS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];
const DOW = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

export interface DayRenderResult {
  disabled?: boolean;
  extraClass?: string;
  children?: ReactNode;
}

export interface MonthCalendarProps {
  selectedDate?: string | null;
  initialYear?: number;
  initialMonth?: number;
  onDayClick?: (date: string) => void;
  renderDay: (date: string, isToday: boolean) => DayRenderResult;
}

function buildGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const dowFirst = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(dowFirst).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MonthCalendar({
  selectedDate,
  initialYear,
  initialMonth,
  onDayClick,
  renderDay,
}: MonthCalendarProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [year, setYear] = useState(() => {
    if (initialYear != null) return initialYear;
    if (selectedDate) return Number(selectedDate.slice(0, 4));
    return today.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (initialMonth != null) return initialMonth;
    if (selectedDate) return Number(selectedDate.slice(5, 7)) - 1;
    return today.getMonth();
  });

  const cells = useMemo(() => buildGrid(year, month), [year, month]);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className={s.root}>
      <div className={s.header}>
        <button className={s.nav} onClick={prev} aria-label="Предыдущий месяц">‹</button>
        <span className={s.title}>{MONTHS[month]} {year}</span>
        <button className={s.nav} onClick={next} aria-label="Следующий месяц">›</button>
      </div>

      <div className={s.grid}>
        {DOW.map(d => <div key={d} className={s.dow}>{d}</div>)}

        {cells.map((day, i) => {
          if (!day) return <div key={i} className={s.empty} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const { disabled, extraClass, children } = renderDay(dateStr, isToday);

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => !disabled && onDayClick?.(dateStr)}
              className={[
                s.day,
                isSelected ? s.selected : "",
                isToday    ? s.today    : "",
                extraClass ?? "",
              ].filter(Boolean).join(" ")}
            >
              <span className={s.dayNum}>{day}</span>
              {children}
            </button>
          );
        })}
      </div>
    </div>
  );
}
