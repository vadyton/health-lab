import { useMemo, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/shared/stores/StoreContext";
import { useActivitiesSummary, useActivitiesList } from "@/entities/activity/api/queries";
import { ActivityCalendar } from "@/widgets/activity-calendar/ui/ActivityCalendar";
import { ActivityList } from "@/widgets/activity-list/ui/ActivityList";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { dataManagementApi, SOURCE_LABELS } from "@/entities/data-management/api/dataManagementApi";
import s from "./DashboardPage.module.scss";

// ── Period stats helpers ───────────────────────────────────────────────────

function startOf(unit: "week" | "month" | "year"): Date {
  const now = new Date();
  if (unit === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (unit === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m} мин`;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function fmtDist(m: number): string {
  if (m < 100) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} км` : `${Math.round(m)} м`;
}

function plural(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 14) return "тренировок";
  if (m10 === 1) return "тренировка";
  if (m10 >= 2 && m10 <= 4) return "тренировки";
  return "тренировок";
}

// ── Component ─────────────────────────────────────────────────────────────

const EXPORT_SOURCES = [
  { label: "Все",        sources: undefined },
  { label: "Zepp Life",  sources: ["zepp_life"] },
  { label: "Mi Fitness", sources: ["mi_fitness"] },
];

const SOURCE_FILTERS = [
  { label: "Все",        value: undefined },
  { label: "Zepp Life",  value: "zepp_life" },
  { label: "Mi Fitness", value: "mi_fitness" },
];

function ExportButton() {
  const [open,       setOpen]       = useState(false);
  const [exporting,  setExporting]  = useState<string | null>(null);
  const [format,     setFormat]     = useState<"tcx" | "fit">("tcx");

  const handleExport = async (label: string, sources?: string[]) => {
    setOpen(false);
    setExporting(label);
    try {
      await dataManagementApi.exportActivities(format, sources);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={s.exportWrap}>
      <button
        className={s.exportBtn}
        onClick={() => setOpen(o => !o)}
        disabled={!!exporting}
      >
        {exporting ? `${exporting}…` : "⬇ Экспорт"}
      </button>
      {open && (
        <div className={s.exportMenu}>
          <div className={s.exportFormatRow}>
            {(["tcx", "fit"] as const).map(f => (
              <button
                key={f}
                className={`${s.exportFmtBtn} ${format === f ? s.exportFmtActive : ""}`}
                onClick={e => { e.stopPropagation(); setFormat(f); }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={s.exportDivider} />
          {EXPORT_SOURCES.map(opt => (
            <button
              key={opt.label}
              className={s.exportMenuItem}
              onClick={() => handleExport(opt.label, opt.sources)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const DashboardPage = observer(() => {
  const { dashboard } = useStore();
  const navigate = useNavigate();

  const { data: summary = [], isLoading: sumLoading } = useActivitiesSummary();
  const {
    data:             pagesData,
    isLoading:        listLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivitiesList(dashboard.filterSource);

  const items = pagesData?.pages.flatMap(p => p.items) ?? [];
  const total = pagesData?.pages[0]?.total ?? 0;

  // Auto-select initial date once summary loads
  useEffect(() => {
    if (!dashboard.filterDate && summary.length === 0) return;
  }, [summary]);

  const periodStats = useMemo(() => {
    return (["week", "month", "year"] as const).map(unit => {
      const cutoff = startOf(unit).getTime() / 1000;
      const recs   = summary.filter(r => r.start >= cutoff);
      return {
        label:     unit === "week" ? "Эта неделя" : unit === "month" ? "Этот месяц" : "Этот год",
        count:     recs.length,
        durationS: recs.reduce((s, r) => s + r.duration,  0),
        calories:  recs.reduce((s, r) => s + r.calories,  0),
        distanceM: recs.reduce((s, r) => s + r.distanceM, 0),
      };
    });
  }, [summary]);

  if (sumLoading || listLoading) return <DashboardSkeleton />;

  return (
    <div className={s.page}>
      <div className={s.top}>
        <h1 className={s.title}>Активности</h1>
        {total > 0 && <span className={s.count}>{total}</span>}
        {dashboard.filterDate && (
          <button className={s.clearFilter} onClick={() => dashboard.setFilterDate(undefined)}>
            × {dashboard.filterDate}
          </button>
        )}
        <button className={s.addBtn} onClick={() => navigate("/activity/new")}>+ Добавить</button>
        {total > 0 && <ExportButton />}
      </div>

      {total > 0 && (
        <div className={s.sourceFilter}>
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.label}
              className={`${s.sourceBtn} ${dashboard.filterSource === f.value ? s.sourceBtnActive : ""}`}
              onClick={() => dashboard.setFilterSource(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {total > 0 && (
        <>
          <div className={s.statsRow}>
            {periodStats.map(p => (
              <div key={p.label} className={s.statBlock}>
                <div className={s.statPeriod}>{p.label}</div>
                <div className={s.statCount}>{p.count} {plural(p.count)}</div>
                <div className={s.statDetails}>
                  <span>⏱ {fmtDur(p.durationS)}</span>
                  {p.calories > 0 && <span>🔥 {Math.round(p.calories).toLocaleString("ru-RU")} ккал</span>}
                  {p.distanceM > 0 && <span>📍 {fmtDist(p.distanceM)}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className={s.layout}>
            <aside className={s.sidebar}>
              <ActivityCalendar summary={summary} onDayClick={d => dashboard.setFilterDate(d)} />
            </aside>
            <main className={s.main}>
              <ActivityList
                activities={items}
                filterDate={dashboard.filterDate}
                hasMore={!!hasNextPage && !dashboard.filterDate}
                onLoadMore={fetchNextPage}
                loadingMore={isFetchingNextPage}
              />
            </main>
          </div>
        </>
      )}

      {total === 0 && (
        <div className={s.empty}>
          <p>Данных нет. Перейдите в раздел «Импорт», загрузите CSV-файлы из Mi Fitness и запустите обработку.</p>
        </div>
      )}
    </div>
  );
});
