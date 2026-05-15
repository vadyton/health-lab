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

export const StepsPage = observer(() => {
  const { steps: store } = useStore();

  const { data, isLoading, isFetching } = useSteps(store.date, store.range);
  const { data: cmpData, isFetching: cmpFetching } = useSteps(store.compareDate, store.range);

  const compareData = store.compare ? cmpData : undefined;
  const primaryLabel = periodLabel(store.date, store.range);
  const cmpLabel     = periodLabel(store.compareDate, store.range);
  const hasData = !!data && (data.total > 0 || data.samples.length > 0);
  const cmpLoading = store.compare && cmpFetching;

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

        <div className={s.dateNav}>
          <button className={s.navBtn} onClick={() => store.stepDate(-1)}>‹</button>
          <input type="date" className={s.dateInput} value={store.date} max={store.today}
            onChange={e => store.setDate(e.target.value)} />
          <button className={s.navBtn} onClick={() => store.stepDate(1)} disabled={!store.canGoForward}>›</button>
        </div>

        <button
          className={`${s.compareBtn} ${store.compare ? s.compareOn : ""}`}
          onClick={() => store.toggleCompare()}>
          ⇌ Сравнить
        </button>
      </div>

      {store.compare && (
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
