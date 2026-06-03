import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { HrSample, MergeStrategy } from "../model/hrMergeLogic";
import { STRATEGIES, mergeHr, hrStats } from "../model/hrMergeLogic";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import s from "./HrMergeModal.module.scss";

interface Props {
  activityId: string;
  activityStart: number;
  miBandSamples: HrSample[];
  externalSamples: HrSample[];
  externalFilename: string;
  onClose: () => void;
  onApplied: (newAvgHr: number, newMaxHr: number) => void;
}

type Status = "idle" | "saving" | "done" | "error";

function relMin(ts: number, base: number) {
  return Math.round((ts - base) / 60);
}

export function HrMergeModal({
  activityId, activityStart,
  miBandSamples, externalSamples, externalFilename,
  onClose, onApplied,
}: Props) {
  const [strategy, setStrategy] = useState<MergeStrategy>("prefer_external");
  const [status, setStatus]     = useState<Status>("idle");
  const [errMsg, setErrMsg]     = useState("");
  const [vis, setVis] = useState({ mb: true, ext: true, merged: true });
  const toggleVis = (key: keyof typeof vis) => setVis(v => ({ ...v, [key]: !v[key] }));

  const merged = useMemo(
    () => mergeHr(miBandSamples, externalSamples, strategy),
    [miBandSamples, externalSamples, strategy],
  );
  const stats = useMemo(() => hrStats(merged), [merged]);

  // Build chart data by minute-window averaging (no pre-downsample to avoid dropping fill points)
  const chartData = useMemo(() => {
    const base = activityStart;

    // Aggregate samples into per-minute buckets, return averaged bpm per minute
    function toMinMap(samples: HrSample[]): Map<number, number> {
      const acc = new Map<number, number[]>();
      for (const s of samples) {
        const m = Math.floor((s.time - base) / 60);
        if (!acc.has(m)) acc.set(m, []);
        acc.get(m)!.push(s.bpm);
      }
      const result = new Map<number, number>();
      for (const [m, bpms] of acc) {
        result.set(m, Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length));
      }
      return result;
    }

    const mbMap     = toMinMap(miBandSamples);
    const extMap    = toMinMap(externalSamples);
    const mergedMap = toMinMap(merged);

    const allMinutes = new Set([...mbMap.keys(), ...extMap.keys(), ...mergedMap.keys()]);
    return [...allMinutes]
      .sort((a, b) => a - b)
      .map(min => ({ min, mb: mbMap.get(min), ext: extMap.get(min), merged: mergedMap.get(min) }));
  }, [miBandSamples, externalSamples, merged, activityStart]);

  const miBandStats    = useMemo(() => hrStats(miBandSamples), [miBandSamples]);
  const externalStats  = useMemo(() => hrStats(externalSamples), [externalSamples]);

  const handleApply = async () => {
    setStatus("saving");
    setErrMsg("");
    try {
      await activitiesApi.mergeHr(activityId, strategy, merged);
      setStatus("done");
      onApplied(stats.avg, stats.max);
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>
        <div className={s.header}>
          <h2 className={s.title}>Слияние данных пульса</h2>
          <button className={s.close} onClick={onClose}>✕</button>
        </div>

        {/* Sources info */}
        <div className={s.sources}>
          <div className={s.source}>
            <span className={s.dot} style={{ background: "#3b82f6" }} />
            <div>
              <div className={s.sourceName}>Mi Band</div>
              <div className={s.sourceMeta}>{miBandSamples.length} точек · ср. {miBandStats.avg} · макс. {miBandStats.max} уд/мин</div>
            </div>
          </div>
          <div className={s.source}>
            <span className={s.dot} style={{ background: "#f97316" }} />
            <div>
              <div className={s.sourceName}>{externalFilename}</div>
              <div className={s.sourceMeta}>{externalSamples.length} точек · ср. {externalStats.avg} · макс. {externalStats.max} уд/мин</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className={s.chart}>
          <div className={s.chartToggles}>
            {([
              { key: "mb",     color: "#3b82f6", label: "Mi Band" },
              { key: "ext",    color: "#f97316", label: "Нагрудный датчик" },
              { key: "merged", color: "#22c55e", label: "Слияние" },
            ] as const).map(({ key, color, label }) => (
              <button
                key={key}
                className={`${s.toggle} ${vis[key] ? s.toggleOn : s.toggleOff}`}
                style={vis[key] ? { borderColor: color, color } : undefined}
                onClick={() => toggleVis(key)}
              >
                <span className={s.toggleDot} style={{ background: vis[key] ? color : "var(--color-border)" }} />
                {label}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="min" tick={{ fontSize: 11 }} tickFormatter={v => `${v}м`} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={34} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number, name: string) => [
                  `${v} уд/мин`,
                  name === "mb" ? "Mi Band" : name === "ext" ? "Нагрудный" : "Слияние",
                ]}
                labelFormatter={v => `${v} мин`}
              />
              <Line hide={!vis.mb}     type="monotone" dataKey="mb"     stroke="#3b82f6" strokeWidth={1.5} dot={false} />
              <Line hide={!vis.ext}    type="monotone" dataKey="ext"    stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line hide={!vis.merged} type="monotone" dataKey="merged" stroke="#22c55e" strokeWidth={2}   dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Strategy */}
        <div className={s.strategies}>
          {STRATEGIES.map(st => (
            <label key={st.id} className={`${s.strategyOption} ${strategy === st.id ? s.selected : ""}`}>
              <input
                type="radio" name="strategy" value={st.id}
                checked={strategy === st.id}
                onChange={() => setStrategy(st.id)}
              />
              <div>
                <div className={s.strategyLabel}>{st.label}</div>
                <div className={s.strategyDesc}>{st.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Result stats */}
        <div className={s.result}>
          <span className={s.dot} style={{ background: "#22c55e" }} />
          <span>Результат: <strong>{merged.length}</strong> точек</span>
          <span className={s.divider}>·</span>
          <span>Ср. пульс: <strong>{stats.avg}</strong></span>
          <span className={s.divider}>·</span>
          <span>Макс: <strong>{stats.max}</strong> уд/мин</span>
        </div>

        {status === "error" && (
          <div className={s.errorMsg}>{errMsg}</div>
        )}

        {/* Actions */}
        <div className={s.actions}>
          <button className={s.btnCancel} onClick={onClose} disabled={status === "saving"}>
            Отмена
          </button>
          <button className={s.btnApply} onClick={handleApply} disabled={status === "saving" || status === "done"}>
            {status === "saving" ? "Сохранение…" :
             status === "done"   ? "✓ Применено" :
                                   "✓ Применить и сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
