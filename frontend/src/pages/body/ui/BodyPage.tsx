import { useState, useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { useBody } from "@/entities/body/api/queries";
import type { BodySample } from "@/entities/body/model/types";
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

function col(v: number | null | undefined, decimals = 1): string {
  return v != null ? v.toFixed(decimals) : "";
}

function downloadCsv(content: string, filename: string, bom = true) {
  const blob = new Blob([bom ? "﻿" + content : content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportFullCsv(samples: BodySample[]) {
  const header = ["Дата", "Время", "Вес (кг)", "ИМТ", "Жир (%)", "Мышцы (%)", "Вода (%)", "Кости (кг)", "Метаболизм (ккал)", "Висцеральный жир"];
  const rows = [[...header]];
  for (const sample of [...samples].sort((a, b) => a.time - b.time)) {
    const d = new Date(sample.time * 1000);
    const date = d.toLocaleDateString("ru-RU");
    const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    rows.push([
      date, time,
      col(sample.weightKg),
      col(sample.bmi),
      col(sample.fatRate),
      col(sample.muscleRate),
      col(sample.bodyWaterRate),
      col(sample.boneMassKg),
      col(sample.metabolism, 0),
      col(sample.visceralFat),
    ]);
  }
  downloadCsv(rows.map(r => r.join(";")).join("\n"), "body.csv");
}

function exportFitbitCsv(samples: BodySample[]) {
  const header = "Date,Weight,BMI,Fat";
  const rows = [header];
  for (const sample of [...samples].sort((a, b) => a.time - b.time)) {
    const d = new Date(sample.time * 1000);
    const date   = d.toISOString().slice(0, 10);
    const weight = sample.weightKg.toFixed(1);
    const bmi    = sample.bmi     != null ? sample.bmi.toFixed(1)     : "0.0";
    const fat    = sample.fatRate != null ? sample.fatRate.toFixed(1) : "0.0";
    rows.push(`"${date}","${weight}","${bmi}","${fat}"`);
  }
  // No BOM — Garmin's parser doesn't handle it well
  downloadCsv("Body\n" + rows.join("\n"), "body_fitbit.csv", false);
}

function ExportMenu({ samples }: { samples: BodySample[] }) {
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
          <button
            className={s.exportItem}
            onClick={() => { exportFullCsv(samples); setOpen(false); }}
          >
            <span className={s.exportItemTitle}>CSV — все данные</span>
            <span className={s.exportItemDesc}>Вес, ИМТ, жир, мышцы, вода, кости…</span>
          </button>
          <button
            className={s.exportItem}
            onClick={() => { exportFitbitCsv(samples); setOpen(false); }}
          >
            <span className={s.exportItemTitle}>Fitbit CSV — для Garmin</span>
            <span className={s.exportItemDesc}>Формат совместимый с импортом в Garmin Connect</span>
          </button>
        </div>
      )}
    </div>
  );
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

        {samples.length > 0 && <ExportMenu samples={samples} />}

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
