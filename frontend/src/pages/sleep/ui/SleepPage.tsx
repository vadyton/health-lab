import { useMemo, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/shared/stores/StoreContext";
import { useSleepSummary, useSleepDetail } from "@/entities/sleep/api/queries";
import type { SleepSummary, SleepRecord, Nap } from "@/entities/sleep/model/types";
import { SleepHistoryChart, buildChartData } from "@/widgets/sleep-chart/ui/SleepHistoryChart";
import { SleepStageBar } from "@/widgets/sleep-chart/ui/SleepChart";
import { SleepCalendar } from "@/widgets/sleep-calendar/ui/SleepCalendar";
import { Spinner } from "@/shared/ui/Spinner";
import { SleepSkeleton } from "./SleepSkeleton";
import { fmtDate, fmtTime, fmtSleepDuration } from "@/shared/lib/formatters";
import s from "./SleepPage.module.scss";

type Period = "week" | "month" | "year";
const PERIOD_DAYS:  Record<Period, number> = { week: 7, month: 30, year: 365 };
const PERIOD_LABEL: Record<Period, string> = { week: "Неделя", month: "Месяц", year: "Год" };

function circularMeanMin(timestamps: number[]): number {
  let sumSin = 0, sumCos = 0;
  for (const ts of timestamps) {
    const d = new Date(ts * 1000);
    const m = d.getHours() * 60 + d.getMinutes();
    const a = (2 * Math.PI * m) / 1440;
    sumSin += Math.sin(a); sumCos += Math.cos(a);
  }
  const n = timestamps.length;
  let angle = Math.atan2(sumSin / n, sumCos / n);
  if (angle < 0) angle += 2 * Math.PI;
  return Math.round((angle * 1440) / (2 * Math.PI)) % 1440;
}
function fmtMin(m: number) {
  return `${String(Math.floor(m / 60) % 24).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`;
}
function scoreColor(s: number) {
  return s >= 80 ? "#38a169" : s >= 60 ? "#d69e2e" : "#e53e3e";
}

function periodRangeLabel(anchorDate: string, period: Period): string {
  const anchor = new Date(anchorDate + "T12:00:00Z");
  const start  = new Date(anchor);
  const days   = PERIOD_DAYS[period];
  start.setUTCDate(anchor.getUTCDate() - days + 1);
  const fmt = (d: Date) => d.toLocaleDateString("ru", { day: "numeric", month: "short" });
  if (period === "year") {
    return `${start.getUTCFullYear()} – ${anchor.getUTCFullYear()}`;
  }
  return `${fmt(start)} – ${fmt(anchor)}`;
}

function computeStats(summary: SleepSummary[], anchorTs: number, days: number) {
  const cutoff = anchorTs - days * 86400;
  const recs = summary.filter(r => r.bedtime >= cutoff && r.bedtime <= anchorTs + 86400);
  if (!recs.length) return null;
  const avgDuration = Math.round(recs.reduce((s, r) => s + r.totalDuration, 0) / recs.length);
  const withScore = recs.filter(r => r.score != null);
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, r) => s + r.score!, 0) / withScore.length) : null;
  const avgBedtime  = circularMeanMin(recs.map(r => r.bedtime));
  const avgWakeTime = circularMeanMin(recs.map(r => r.wakeUpTime));
  let trend: "improving" | "stable" | "declining" = "stable";
  if (recs.length >= 6) {
    const half = Math.floor(recs.length / 2);
    const rAvg = recs.slice(0, half).reduce((s, r) => s + r.totalDuration, 0) / half;
    const oAvg = recs.slice(half).reduce( (s, r) => s + r.totalDuration, 0) / (recs.length - half);
    trend = rAvg - oAvg > 10 ? "improving" : oAvg - rAvg > 10 ? "declining" : "stable";
  }
  const DOW_RU = ["вс","пн","вт","ср","чт","пт","сб"];
  const byDow = new Map<number, number[]>();
  for (const r of recs) {
    const dow = new Date(r.bedtime * 1000).getDay();
    if (!byDow.has(dow)) byDow.set(dow, []);
    byDow.get(dow)!.push(r.totalDuration);
  }
  let bestDow = -1, bestAvg = 0;
  for (const [dow, durs] of byDow) {
    const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
    if (avg > bestAvg) { bestAvg = avg; bestDow = dow; }
  }
  const mean = recs.reduce((s, r) => s + r.totalDuration, 0) / recs.length;
  const std  = Math.sqrt(recs.reduce((s, r) => s + (r.totalDuration - mean) ** 2, 0) / recs.length);
  return {
    count: recs.length, avgDuration, avgBedtime, avgWakeTime, avgScore, trend,
    bestDay: bestDow >= 0 ? DOW_RU[bestDow] : null,
    bestDayDur: Math.round(bestAvg),
    isConsistent: std < 45, stdMin: Math.round(std),
  };
}

// ── Page ───────────────────────────────────────────────────────────────────

export const SleepPage = observer(() => {
  const { sleep: store } = useStore();
  const { data: summary = [], isLoading } = useSleepSummary();

  const dateMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of summary) {
      const d = new Date(r.bedtime * 1000).toISOString().slice(0, 10);
      if (!m.has(d)) m.set(d, r.id);
    }
    return m;
  }, [summary]);

  useEffect(() => {
    if (!store.selectedDate && summary.length) {
      store.setSelectedDate(new Date(summary[0].bedtime * 1000).toISOString().slice(0, 10));
    }
  }, [summary, store]);

  const selectedId = store.selectedDate ? dateMap.get(store.selectedDate) ?? null : null;
  const { data: selectedRec, isLoading: detailLoading } = useSleepDetail(selectedId);

  const stats     = useMemo(() => computeStats(summary, store.anchorTs, PERIOD_DAYS[store.period]), [summary, store.anchorTs, store.period]);
  const chartData = useMemo(() => buildChartData(summary, store.period, store.anchorTs), [summary, store.period, store.anchorTs]);

  // Swipe handling
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) store.stepPeriod(dx > 0 ? -1 : 1);
    touchStartX.current = null;
  };

  if (isLoading) return <SleepSkeleton />;

  if (!summary.length) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Сон</h1>
        <div className={s.empty}>Нет данных о сне. Загрузите данные Mi Fitness.</div>
      </div>
    );
  }

  const trendIcon  = stats?.trend === "improving" ? "↑" : stats?.trend === "declining" ? "↓" : "→";
  const trendLabel = stats?.trend === "improving" ? "улучшается" : stats?.trend === "declining" ? "ухудшается" : "стабильно";
  const trendColor = stats?.trend === "improving" ? "#38a169" : stats?.trend === "declining" ? "#e53e3e" : "#718096";

  return (
    <div className={s.page}>
      <div className={s.topRow}>
        <h1 className={s.title}>Сон <span className={s.count}>{summary.length}</span></h1>
        <div className={s.tabs}>
          {(["week","month","year"] as Period[]).map(p => (
            <button key={p} className={`${s.tab} ${store.period === p ? s.tabActive : ""}`}
              onClick={() => store.setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation */}
      <div className={s.periodNav} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <button className={s.navBtn} onClick={() => store.stepPeriod(-1)}>‹</button>
        <span className={s.periodLabel}>{periodRangeLabel(store.anchorDate, store.period)}</span>
        <button className={s.navBtn} onClick={() => store.stepPeriod(1)} disabled={!store.canGoForward}>›</button>
        <input
          type="date"
          className={s.anchorInput}
          value={store.anchorDate}
          max={store.today}
          onChange={e => store.setAnchorDate(e.target.value)}
          title="Выбрать конечную дату периода"
        />
      </div>

      {stats && (
        <div className={s.statsGrid}>
          <StatCard val={`😴 ${fmtSleepDuration(stats.avgDuration)}`} label="Средний сон" />
          <StatCard val={`🌙 ${fmtMin(stats.avgBedtime)}`}            label="Засыпание" />
          <StatCard val={`☀️ ${fmtMin(stats.avgWakeTime)}`}           label="Подъём" />
          {stats.avgScore != null && (
            <StatCard val={`⭐ ${stats.avgScore}`} label="Ср. оценка" color={scoreColor(stats.avgScore)} />
          )}
          <StatCard val={`${trendIcon} ${trendLabel}`} label="Тенденция" color={trendColor} />
          <StatCard val={`📊 ${stats.count}`} label="Ночей" />
        </div>
      )}

      {stats && (
        <div className={s.insights}>
          {stats.bestDay && (
            <span className={s.insight}>
              🏆 Лучший сон в <strong>{stats.bestDay}</strong> — {fmtSleepDuration(stats.bestDayDur)}
            </span>
          )}
          <span className={s.insight}>
            {stats.isConsistent
              ? `✅ Стабильный режим — разброс ${stats.stdMin} мин`
              : `⚠️ Нестабильный режим — разброс ${stats.stdMin} мин`}
          </span>
        </div>
      )}

      {chartData.length > 1 && (
        <div className={s.chartCard}>
          <div className={s.chartHeader}>
            <span className={s.chartTitle}>История сна</span>
            <div className={s.chartLegend}>
              <span><i style={{ background: "#2b6cb0" }} />Глубокий</span>
              <span><i style={{ background: "#805ad5" }} />REM</span>
              <span><i style={{ background: "#90cdf4" }} />Лёгкий</span>
            </div>
          </div>
          <SleepHistoryChart data={chartData} />
        </div>
      )}

      <div className={s.layout}>
        <aside className={s.sidebar}>
          <SleepCalendar
            summary={summary}
            selectedDate={store.selectedDate}
            onDayClick={d => store.setSelectedDate(d)}
          />
        </aside>
        <main className={s.main}>
          {detailLoading && <div className={s.detailSpinner}><Spinner size={24} /></div>}
          {!detailLoading && selectedRec && <SleepDetail record={selectedRec} />}
          {!detailLoading && !selectedRec && store.selectedDate && (
            <div className={s.emptyDetail}>Выберите день в календаре</div>
          )}
        </main>
      </div>
    </div>
  );
});

function StatCard({ val, label, color }: { val: string; label: string; color?: string }) {
  return (
    <div className={s.statCard}>
      <div className={s.statVal} style={color ? { color } : undefined}>{val}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

function NapSection({ naps }: { naps: Nap[] }) {
  const totalNapMin = naps.reduce((s, n) => s + (n.durationMin ?? Math.round((n.end - n.start) / 60)), 0);
  return (
    <div className={s.napSection}>
      <div className={s.stagesTitle}>Дневной сон — {fmtSleepDuration(totalNapMin)}</div>
      {naps.map((nap, i) => {
        const durMin = nap.durationMin ?? Math.round((nap.end - nap.start) / 60);
        return (
          <div key={i} className={s.napItem}>
            <span className={s.napTime}>{fmtTime(nap.start)} – {fmtTime(nap.end)}</span>
            <span className={s.napDur}>{fmtSleepDuration(durMin)}</span>
            {(nap.deepMin != null || nap.lightMin != null || nap.remMin != null) && (
              <span className={s.napPhases}>
                {nap.deepMin  != null && <span style={{ color: "#2b6cb0" }}>г {fmtSleepDuration(nap.deepMin)}</span>}
                {nap.remMin   != null && <span style={{ color: "#805ad5" }}>rem {fmtSleepDuration(nap.remMin)}</span>}
                {nap.lightMin != null && <span style={{ color: "#63b3ed" }}>л {fmtSleepDuration(nap.lightMin)}</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SleepDetail({ record }: { record: SleepRecord }) {
  return (
    <div className={s.detail}>
      <div className={s.detailHeader}>
        <div className={s.detailDate}>{fmtDate(record.bedtime)}</div>
        <div className={s.detailTime}>{fmtTime(record.bedtime)} – {fmtTime(record.wakeUpTime)}</div>
      </div>
      <div className={s.detailStats}>
        <Stat val={fmtSleepDuration(record.totalDuration)} label="Всего" />
        <Stat val={fmtSleepDuration(record.deepDuration)}  label="Глубокий" color="#2b6cb0" />
        <Stat val={fmtSleepDuration(record.remDuration)}   label="REM"      color="#805ad5" />
        <Stat val={fmtSleepDuration(record.lightDuration)} label="Лёгкий"   color="#63b3ed" />
        {record.score   != null && <Stat val={String(record.score)}   label="Оценка"    color={scoreColor(record.score)} />}
        {record.avgHr   != null && <Stat val={`❤️ ${record.avgHr}`} label="Ср. пульс" />}
        {record.avgSpo2 != null && <Stat val={`${record.avgSpo2}%`}  label="SpO2" color={record.avgSpo2 < 95 ? "#e53e3e" : undefined} />}
        {record.avgBreath  != null && <Stat val={String(record.avgBreath)}  label="Дых/мин" />}
        {record.awakeCount != null && <Stat val={String(record.awakeCount)} label="Пробуждений" />}
      </div>
      {record.stages && record.stages.length > 0 && (
        <div className={s.stages}>
          <div className={s.stagesTitle}>Ночной сон — фазы</div>
          <SleepStageBar record={record} />
        </div>
      )}
      {record.naps && record.naps.length > 0 && (
        <NapSection naps={record.naps} />
      )}
    </div>
  );
}

function Stat({ val, label, color }: { val: string; label: string; color?: string }) {
  return (
    <div className={s.ds}>
      <span className={s.dsVal} style={color ? { color } : undefined}>{val}</span>
      <span className={s.dsLabel}>{label}</span>
    </div>
  );
}
