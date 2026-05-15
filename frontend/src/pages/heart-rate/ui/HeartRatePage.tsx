import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { useHeartRate } from "@/entities/heart-rate/api/queries";
import { useSpo2 } from "@/entities/spo2/api/queries";
import { HRChart } from "@/widgets/hr-chart/ui/HRChart";
import { Spo2Chart } from "@/widgets/spo2-chart/ui/Spo2Chart";
import { StatCard } from "@/shared/ui/StatCard";
import { Spinner } from "@/shared/ui/Spinner";
import { HeartRateSkeleton } from "./HeartRateSkeleton";
import s from "./HeartRatePage.module.scss";

const RANGES = [
  { id: "day"   as const, label: "День"   },
  { id: "week"  as const, label: "Неделя" },
  { id: "month" as const, label: "Месяц"  },
  { id: "year"  as const, label: "Год"    },
];

const DENSITY_LEVELS = [0, 1, 2, 3, 4];

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

export const HeartRatePage = observer(() => {
  const { heartRate: store } = useStore();

  const { data, isLoading, isFetching } = useHeartRate(store.date,        store.range);
  const { data: cmpData, isFetching: cmpFetching } = useHeartRate(store.compareDate, store.range);
  const { data: spo2  } = useSpo2(store.date, store.range);

  const compareData = store.compare ? cmpData : undefined;
  const primaryLabel = periodLabel(store.date, store.range);
  const cmpLabel     = periodLabel(store.compareDate, store.range);
  const hasData = !!data && (data.avg > 0 || (data.samples?.length ?? 0) > 0);

  if (!data && isLoading) return <HeartRateSkeleton />;

  const cmpLoading = store.compare && cmpFetching;

  return (
    <div className={s.page}>
      <h1 className={s.title}>Пульс</h1>

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
            <span className={s.periodDot} style={{ background: "#e53e3e" }} />
            Текущий: <strong>{primaryLabel}</strong>
          </span>
          <span className={s.periodDivider}>vs</span>
          <span className={s.periodCompare}>
            <span className={s.periodDot} style={{ background: "#e53e3e", opacity: 0.4 }} />
            Сравнение: <strong>{cmpLabel}</strong>
            {cmpLoading && <Spinner size={12} />}
          </span>
        </div>
      )}

      {/* Unified density slider for HR + SpO2 */}
      <div className={s.sliderRow}>
        <span className={s.sliderLabel}>Точек</span>
        <input
          type="range"
          min={0} max={4} step={1}
          value={store.densityLevel}
          onChange={e => store.setDensityLevel(Number(e.target.value))}
          className={s.slider}
        />
        <span className={s.sliderVal}>{store.densityLabel}</span>
        <div className={s.densityTicks}>
          {DENSITY_LEVELS.map(l => (
            <button
              key={l}
              className={`${s.densityTick} ${store.densityLevel === l ? s.densityTickActive : ""}`}
              onClick={() => store.setDensityLevel(l)}
            >
              {Math.round(100 / Math.pow(2, l))}%
            </button>
          ))}
        </div>
      </div>

      <div className={`${s.dataArea} ${isFetching ? s.fetching : ""}`}>
      {hasData && (
        <>
          {data!.avg > 0 && (
            <div className={s.stats}>
              <StatCard label={`Ср. пульс${store.compare ? ` (${primaryLabel})` : ""}`}
                value={data!.avg} unit="уд/мин" icon="❤️" color="#e53e3e" />
              <StatCard label="Мин. пульс" value={data!.min} unit="уд/мин" icon="📉" />
              <StatCard label="Макс. пульс" value={data!.max} unit="уд/мин" icon="📈" />
              {store.compare && compareData && compareData.avg > 0 && (
                <>
                  <StatCard label={`Ср. пульс (${cmpLabel})`} value={compareData.avg} unit="уд/мин" icon="❤️" />
                  <StatCard label={`Мин. (${cmpLabel})`} value={compareData.min} unit="уд/мин" icon="📉" />
                  <StatCard label={`Макс. (${cmpLabel})`} value={compareData.max} unit="уд/мин" icon="📈" />
                </>
              )}
            </div>
          )}

          <div className={s.chartCard}>
            {(data!.samples?.length ?? 0) > 0 ? (
              <HRChart
                samples={data!.samples!}
                compareSamples={compareData?.samples}
                compareLabel={cmpLabel}
                range={store.range}
                densityLevel={store.densityLevel}
              />
            ) : (
              <div className={s.noData}>
                Нет данных за выбранный период.
                {(data?.availableDates?.length ?? 0) > 0 && (
                  <span> Данные есть с {data!.availableDates[data!.availableDates.length - 1]} по {data!.availableDates[0]}.</span>
                )}
              </div>
            )}
          </div>

          {spo2 && spo2.samples.length > 0 && (
            <div className={s.spo2Section}>
              <div className={s.spo2Header}>
                <span className={s.spo2Title}>SpO2</span>
                <div className={s.spo2Stats}>
                  <span>ср. <strong>{spo2.avg}%</strong></span>
                  <span>мин. <strong style={{ color: spo2.min < 95 ? "#e53e3e" : undefined }}>{spo2.min}%</strong></span>
                  <span>макс. <strong>{spo2.max}%</strong></span>
                </div>
              </div>
              <div className={s.chartCard}>
                <Spo2Chart samples={spo2.samples} range={store.range} densityLevel={store.densityLevel} />
              </div>
            </div>
          )}
        </>
      )}

      {!hasData && (
        <div className={s.noData}>Нет данных за выбранный период.</div>
      )}
      </div>
    </div>
  );
});
