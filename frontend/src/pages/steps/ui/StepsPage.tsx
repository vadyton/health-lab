import { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { useSteps } from "@/entities/steps/api/queries";
import { StepsChart } from "@/widgets/steps-chart/ui/StepsChart";
import { StatCard } from "@/shared/ui/StatCard";
import { Spinner } from "@/shared/ui/Spinner";
import { StepsSkeleton } from "./StepsSkeleton";
import s from "./StepsPage.module.scss";

const RANGES = [
  { id: "day"   as const, label: "День"   },
  { id: "week"  as const, label: "Неделя" },
  { id: "month" as const, label: "Месяц"  },
  { id: "year"  as const, label: "Год"    },
  { id: "all"   as const, label: "Всё"    },
];

function fmtDateRu(date: string): string {
  const [y, m, d] = date.split("-");
  const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}
function periodLabel(date: string, range: string): string {
  const end = new Date(date + "T12:00:00Z");
  switch (range) {
    case "day": return fmtDateRu(date);
    case "week": {
      const s = new Date(end); s.setUTCDate(s.getUTCDate() - 6);
      return `${fmtDateRu(s.toISOString().slice(0,10))} – ${fmtDateRu(date)}`;
    }
    case "month": {
      const s = new Date(end); s.setUTCDate(s.getUTCDate() - 29);
      return `${fmtDateRu(s.toISOString().slice(0,10))} – ${fmtDateRu(date)}`;
    }
    default: {
      const s = new Date(end); s.setUTCFullYear(s.getUTCFullYear() - 1); s.setUTCDate(s.getUTCDate() + 1);
      return `${fmtDateRu(s.toISOString().slice(0,10))} – ${fmtDateRu(date)}`;
    }
  }
}
function fmtDist(m: number) {
  return m >= 1000 ? (m / 1000).toFixed(2) + " км" : Math.round(m) + " м";
}

function downloadFitbitCsv(samples: { time: number; steps: number; distance: number; calories: number }[]) {
  // Aggregate by date (handles intra-day intervals for "day" range) and drop zero-step days
  const byDate = new Map<string, { steps: number; distance: number; calories: number }>();
  for (const s of samples) {
    const date = new Date(s.time * 1000).toISOString().slice(0, 10);
    const cur = byDate.get(date) ?? { steps: 0, distance: 0, calories: 0 };
    byDate.set(date, { steps: cur.steps + s.steps, distance: cur.distance + s.distance, calories: cur.calories + s.calories });
  }

  const header = "Date,Calories Burned,Steps,Distance,Floors,Minutes Sedentary,Minutes Lightly Active,Minutes Fairly Active,Minutes Very Active,Activity Calories";
  const lines: string[] = [];
  for (const [date, v] of [...byDate.entries()].sort()) {
    if (v.steps === 0) continue;
    const dist = (v.distance / 1609.34).toFixed(2); // Fitbit format uses miles
    const cal  = Math.round(v.calories);
    lines.push(`"${date}","${cal}","${v.steps}","${dist}","0","0","0","0","0","${cal}"`);
  }
  const csv = "Activities\n" + header + "\n" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "activities_fitbit.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ExportMenu({ samples }: { samples: { time: number; steps: number; distance: number; calories: number }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className={s.exportWrap} ref={ref}>
      <button className={s.exportBtn} onClick={() => setOpen(o => !o)}>
        Экспорт <span className={s.caret}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className={s.exportMenu}>
          <button className={s.exportItem} onClick={() => { downloadFitbitCsv(samples); setOpen(false); }}>
            <span className={s.exportItemTitle}>Fitbit CSV — для Garmin</span>
            <span className={s.exportItemDesc}>Шаги и калории за выбранный период</span>
          </button>
        </div>
      )}
    </div>
  );
}

export const StepsPage = observer(() => {
  const { steps: store } = useStore();

  const { data, isLoading, isFetching } = useSteps(store.date, store.range);
  const { data: cmpData, isFetching: cmpFetching } = useSteps(store.compareDate, store.range);

  const isAll = store.range === "all";
  const compareData = store.compare && !isAll ? cmpData : undefined;
  const primaryLabel = periodLabel(store.date, store.range);
  const cmpLabel     = periodLabel(store.compareDate, store.range);
  const hasData = !!data && (data.total > 0 || data.samples.length > 0);
  const cmpLoading = store.compare && !isAll && cmpFetching;

  if (!data && isLoading) return <StepsSkeleton />;

  return (
    <div className={s.page}>
      <h1 className={s.title}>Шаги</h1>

      <div className={s.controls}>
        <div className={s.seg}>
          {RANGES.map(r => (
            <button key={r.id}
              className={`${s.segBtn} ${store.range === r.id ? s.active : ""}`}
              onClick={() => store.setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>

        {!isAll && (
          <div className={s.dateNav}>
            <button className={s.navBtn} onClick={() => store.stepDate(-1)}>‹</button>
            <input type="date" className={s.dateInput} value={store.date} max={store.today}
              onChange={e => store.setDate(e.target.value)} />
            <button className={s.navBtn} onClick={() => store.stepDate(1)} disabled={!store.canGoForward}>›</button>
          </div>
        )}

        {hasData && <ExportMenu samples={data!.samples} />}

        {!isAll && (
          <button
            className={`${s.compareBtn} ${store.compare ? s.compareOn : ""}`}
            onClick={() => store.toggleCompare()}>
            ⇌ Сравнить
          </button>
        )}
      </div>

      {store.compare && !isAll && (
        <div className={s.periodRow}>
          <span className={s.periodCurrent}>
            <span className={s.periodDot} style={{ background: "#4299e1" }} />
            Текущий: <strong>{primaryLabel}</strong>
          </span>
          <span className={s.periodDivider}>vs</span>
          <span className={s.periodCompare}>
            <span className={s.periodDot} style={{ background: "#bee3f8" }} />
            Сравнение: <strong>{cmpLabel}</strong>
            {cmpLoading && <Spinner size={12} />}
          </span>
        </div>
      )}

      <div className={`${s.dataArea} ${isFetching ? s.fetching : ""}`}>
      {hasData && (
        <>
          <div className={s.stats}>
            <StatCard label={`Шаги${store.compare ? ` (${primaryLabel})` : ""}`}
              value={data!.total.toLocaleString("ru-RU")} icon="👟" />
            {data!.distance > 0 && <StatCard label="Дистанция" value={fmtDist(data!.distance)} icon="📍" />}
            {data!.calories > 0 && <StatCard label="Калории" value={Math.round(data!.calories)} unit="ккал" icon="🔥" />}
            {data!.goal && store.range === "day" && (
              <StatCard label="Выполнено" value={Math.round((data!.total / data!.goal) * 100)} unit="%" icon="🎯" />
            )}
            {store.compare && compareData && compareData.total > 0 && (
              <>
                <StatCard label={`Шаги (${cmpLabel})`} value={compareData.total.toLocaleString("ru-RU")} icon="👟" />
                {compareData.distance > 0 && (
                  <StatCard label="Дистанция (пред.)" value={fmtDist(compareData.distance)} icon="📍" />
                )}
              </>
            )}
          </div>

          <div className={s.chartCard}>
            {data!.samples.length > 0 ? (
              <StepsChart
                samples={data!.samples}
                compareSamples={compareData?.samples}
                compareLabel={cmpLabel}
                range={store.range}
              />
            ) : (
              <div className={s.noData}>Нет данных за выбранный период.</div>
            )}
          </div>
        </>
      )}

      {!hasData && (
        <div className={s.noData}>
          Нет данных за выбранный период.
          {(data?.availableDates?.length ?? 0) > 0 && (
            <span> Данные есть с {data!.availableDates[0]} по {data!.availableDates[data!.availableDates.length - 1]}.</span>
          )}
        </div>
      )}
      </div>{/* /dataArea */}
    </div>
  );
});
