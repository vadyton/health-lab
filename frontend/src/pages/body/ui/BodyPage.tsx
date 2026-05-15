import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { useBody } from "@/entities/body/api/queries";
import { BodyChart } from "@/widgets/body-chart/ui/BodyChart";
import { StatCard } from "@/shared/ui/StatCard";
import s from "./BodyPage.module.scss";

const RANGES = [
  { id: "month" as const, label: "Месяц" },
  { id: "year"  as const, label: "Год"   },
  { id: "all"   as const, label: "Всё"   },
];

const CHARTS: {
  metric: "weightKg" | "bmi" | "fatRate" | "muscleRate" | "bodyWaterRate" | "boneMassKg" | "metabolism" | "visceralFat";
  label:  string;
  unit:   string;
  color:  string;
}[] = [
  { metric: "weightKg",      label: "Вес",            unit: "кг",    color: "#3b82f6" },
  { metric: "bmi",           label: "ИМТ",            unit: "",      color: "#8b5cf6" },
  { metric: "fatRate",       label: "Жир",            unit: "%",     color: "#ef4444" },
  { metric: "muscleRate",    label: "Мышцы",          unit: "%",     color: "#10b981" },
  { metric: "bodyWaterRate", label: "Вода",           unit: "%",     color: "#06b6d4" },
  { metric: "boneMassKg",    label: "Кости",          unit: "кг",    color: "#f59e0b" },
  { metric: "metabolism",    label: "Метаболизм",     unit: "ккал",  color: "#f97316" },
  { metric: "visceralFat",   label: "Висцеральный жир", unit: "ед", color: "#dc2626" },
];

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

export const BodyPage = observer(() => {
  const { body: store } = useStore();
  const { data, isLoading, isFetching } = useBody(store.date, store.range);

  if (isLoading) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Вес и состав тела</h1>
        <div className={s.noData}>Загрузка…</div>
      </div>
    );
  }

  const latest  = data?.latest;
  const samples = data?.samples ?? [];
  const hasData = samples.length > 0 || !!latest;

  return (
    <div className={s.page}>
      <h1 className={s.title}>Вес и состав тела</h1>

      <div className={s.controls}>
        <div className={s.seg}>
          {RANGES.map(r => (
            <button
              key={r.id}
              className={`${s.segBtn} ${store.range === r.id ? s.active : ""}`}
              onClick={() => store.setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {store.range !== "all" && (
          <div className={s.dateNav}>
            <button className={s.navBtn} onClick={() => store.stepDate(-1)}>‹</button>
            <input
              type="date"
              className={s.dateInput}
              value={store.date}
              max={store.today}
              onChange={e => store.setDate(e.target.value)}
            />
            <button className={s.navBtn} onClick={() => store.stepDate(1)} disabled={!store.canGoForward}>›</button>
          </div>
        )}
      </div>

      <div className={`${s.dataArea} ${isFetching ? s.fetching : ""}`}>
        {hasData && (
          <>
            {latest && (
              <div className={s.stats}>
                <StatCard label="Вес"              value={fmt(latest.weightKg)}      unit="кг"   icon="⚖️" color="#3b82f6" />
                {latest.bmi        != null && <StatCard label="ИМТ"              value={fmt(latest.bmi)}          unit=""     icon="📊" />}
                {latest.fatRate    != null && <StatCard label="Жировая масса"    value={fmt(latest.fatRate)}      unit="%"    icon="🔴" color="#ef4444" />}
                {latest.muscleRate != null && <StatCard label="Мышечная масса"   value={fmt(latest.muscleRate)}   unit="%"    icon="💪" color="#10b981" />}
                {latest.bodyWaterRate != null && <StatCard label="Вода"          value={fmt(latest.bodyWaterRate)} unit="%"   icon="💧" color="#06b6d4" />}
                {latest.boneMassKg   != null && <StatCard label="Масса костей"   value={fmt(latest.boneMassKg)}  unit="кг"   icon="🦴" color="#f59e0b" />}
                {latest.metabolism   != null && <StatCard label="Метаболизм"     value={fmt(latest.metabolism, 0)} unit="ккал" icon="🔥" color="#f97316" />}
                {latest.visceralFat  != null && <StatCard label="Висцеральный жир" value={fmt(latest.visceralFat)} unit="ед" icon="⚠️" color="#dc2626" />}
              </div>
            )}

            {samples.length > 0 && (
              <div className={s.chartsGrid}>
                {CHARTS.map(({ metric, label, unit, color }) => {
                  const hasSamples = samples.some(s => s[metric] != null);
                  if (!hasSamples) return null;
                  return (
                    <div key={metric} className={s.chartCard}>
                      <div className={s.chartTitle}>{label}{unit ? `, ${unit}` : ""}</div>
                      <BodyChart
                        samples={samples}
                        metric={metric}
                        label={label}
                        unit={unit}
                        color={color}
                        range={store.range}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!hasData && (
          <div className={s.noData}>
            Нет данных за выбранный период.
            {(data?.availableDates?.length ?? 0) > 0 && (
              <span> Данные есть за {data!.availableDates[data!.availableDates.length - 1]} – {data!.availableDates[0]}.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
