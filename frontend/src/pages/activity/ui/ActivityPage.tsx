import { useState, lazy, Suspense, Component, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useActivityDetail } from "@/entities/activity/api/queries";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import { qk } from "@/shared/api/queryKeys";
import { HRDayChart } from "@/widgets/hr-chart/ui/HRChart";
import { EditActivityForm } from "@/features/edit-activity/ui/EditActivityForm";

const ActivityMap = lazy(() =>
  import("@/widgets/activity-map/ui/ActivityMap").then(m => ({ default: m.ActivityMap })),
);

class MapErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "var(--color-muted)", fontSize: 13 }}>
          Карта недоступна: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
import { ExternalHrUpload } from "@/features/merge-hr/ui/ExternalHrUpload";
import { GpxUpload } from "@/features/import-gpx/ui/GpxUpload";
import { StatCard } from "@/shared/ui/StatCard";
import { ActivitySkeleton } from "./ActivitySkeleton";
import { sportLabel, sportIcon } from "@/shared/lib/sportLabels";
import { fmtDate, fmtTime, fmtDuration } from "@/shared/lib/formatters";
import type { Activity } from "@/entities/activity/model/types";
import s from "./ActivityPage.module.scss";

export function ActivityPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [attachingHr, setAttachingHr] = useState(false);
  const [attachHrMsg, setAttachHrMsg] = useState("");

  const { data: activity, isLoading, error, setData, refetch } = useActivityDetailWithSetter(id!);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Удалить активность? Это удалит TCX и FIT файлы.")) return;
    setDeleting(true);
    try {
      await activitiesApi.delete(id);
      queryClient.invalidateQueries({ queryKey: qk.activities.all() });
      navigate("/");
    } catch (e: unknown) {
      alert("Ошибка удаления: " + (e as Error).message);
      setDeleting(false);
    }
  };

  const handleAttachHrFromDb = async () => {
    if (!id) return;
    setAttachingHr(true);
    setAttachHrMsg("");
    try {
      const result = await activitiesApi.attachHrFromDb(id);
      if (result.count === 0) {
        setAttachHrMsg("В базе нет данных о пульсе за этот период.");
      } else {
        setAttachHrMsg(`Добавлено ${result.count} записей пульса.`);
        setData(a => a ? {
          ...a,
          avgHr:     result.avgHr,
          maxHr:     result.maxHr,
          hrSamples: result.samples,
        } : a);
      }
    } catch (e: unknown) {
      setAttachHrMsg("Ошибка: " + (e as Error).message);
    } finally {
      setAttachingHr(false);
    }
  };

  if (isLoading) return <ActivitySkeleton />;
  if (error || !activity) {
    return (
      <div className={s.page}>
        <div className={s.topBar}>
          <button className={s.back} onClick={() => navigate(-1)}>← Назад</button>
        </div>
        <div className={s.error}>{(error as Error)?.message ?? "Активность не найдена"}</div>
      </div>
    );
  }

  const zoneTotal = activity.hrZones
    ? Object.values(activity.hrZones).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.back} onClick={() => navigate(-1)}>← Назад</button>
        <button className={s.btnDelete} onClick={handleDelete} disabled={deleting}>
          {deleting ? "Удаление…" : "🗑 Удалить"}
        </button>
      </div>

      <div className={s.header}>
        <span className={s.sportIcon}>{sportIcon(activity.category)}</span>
        <div>
          <h1 className={s.title}>{activity.title ?? sportLabel(activity.category)}</h1>
          <div className={s.subtitle}>
            {fmtDate(activity.start)} · {fmtTime(activity.start)} – {fmtTime(activity.end)}
            {activity.source && (
              <span className={s.sourceTag}>
                {activity.source === "zepp_life" ? "Zepp Life" : activity.source === "mi_fitness" ? "Mi Fitness" : activity.source}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={s.stats}>
        <StatCard label="Длительность" value={fmtDuration(activity.duration)} icon="⏱️" />
        {activity.calories > 0 && (
          <StatCard label="Калории" value={Math.round(activity.calories)} unit="ккал" icon="🔥" />
        )}
        {(activity.avgHr ?? 0) > 0 && (
          <StatCard label="Ср. пульс" value={Math.round(activity.avgHr!)} unit="уд/мин" icon="❤️" color="#e53e3e" />
        )}
        {(activity.maxHr ?? 0) > 0 && (
          <StatCard label="Макс. пульс" value={Math.round(activity.maxHr!)} unit="уд/мин" icon="📈" color="#e53e3e" />
        )}
        {activity.trainLoad != null && activity.trainLoad > 0 && (
          <StatCard label="Нагрузка" value={Math.round(activity.trainLoad)} icon="💪" />
        )}
        {activity.recoverTime != null && activity.recoverTime > 0 && (
          <StatCard label="Восстан." value={activity.recoverTime} unit="мин" icon="🔄" />
        )}
        {activity.distanceM != null && activity.distanceM > 0 && (
          <StatCard label="Дистанция" value={(activity.distanceM / 1000).toFixed(2)} unit="км" icon="📍" />
        )}
        {activity.avgSpeed != null && activity.avgSpeed > 0 && (
          <StatCard label="Ср. скорость" value={(activity.avgSpeed * 3.6).toFixed(1)} unit="км/ч" icon="💨" />
        )}
        {activity.totalAscent != null && activity.totalAscent > 0 && (
          <StatCard label="Набор" value={Math.round(activity.totalAscent)} unit="м" icon="⛰️" />
        )}
      </div>

      <section className={s.section}>
        <div className={s.sectionRow}>
          <h2 className={s.sectionTitle}>Маршрут</h2>
          <GpxUpload
            activityId={activity.id}
            onApplied={(count, stats) => {
              queryClient.invalidateQueries({ queryKey: qk.activities.detail(id!) });
              if (stats) {
                setData(a => a ? {
                  ...a,
                  distanceM:    stats.distanceM,
                  duration:     stats.durationS,
                  avgSpeed:     stats.avgSpeed,
                  maxSpeed:     stats.maxSpeed,
                  totalAscent:  stats.totalAscent,
                  totalDescent: stats.totalDescent,
                } : a);
              }
            }}
          />
        </div>
        {activity.gpsPoints && activity.gpsPoints.length > 1 ? (
          <div className={s.card}>
            <MapErrorBoundary>
              <Suspense fallback={
                <div style={{ height: 380, background: "var(--color-surface)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: 13 }}>
                  Загрузка карты…
                </div>
              }>
                <ActivityMap
                  activityId={activity.id}
                  points={activity.gpsPoints}
                  onRecalculated={(trimmedPts, stats) =>
                    setData(a => a ? {
                      ...a,
                      distanceM:    stats.distanceM,
                      duration:     stats.durationS,
                      avgSpeed:     stats.avgSpeed,
                      maxSpeed:     stats.maxSpeed,
                      totalAscent:  stats.totalAscent,
                      totalDescent: stats.totalDescent,
                      gpsPoints:    trimmedPts,
                    } : a)
                  }
                />
              </Suspense>
            </MapErrorBoundary>
          </div>
        ) : (
          <div className={s.card} style={{ padding: "var(--sp-5)", color: "var(--color-muted)", fontSize: 13 }}>
            Нет данных маршрута. Загрузите GPX файл, чтобы добавить маршрут.
          </div>
        )}
      </section>

      <section className={s.section}>
        <div className={s.sectionRow}>
          <h2 className={s.sectionTitle}>Пульс</h2>
          <ExternalHrUpload
            activity={activity}
            onApplied={(avg, max) => setData(a => a ? { ...a, avgHr: avg, maxHr: max } : a)}
          />
        </div>
        {activity.hrSamples && activity.hrSamples.length > 0 ? (
          <div className={s.card}>
            <HRDayChart samples={activity.hrSamples} />
          </div>
        ) : (
          <div className={s.card} style={{ padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <span style={{ color: "var(--color-muted)", fontSize: 13 }}>
              Нет данных пульса от Mi Band.
            </span>
            <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center" }}>
              <button className={s.btnAttachHr} onClick={handleAttachHrFromDb} disabled={attachingHr}>
                {attachingHr ? "Загрузка…" : "Добавить пульс из имеющихся данных"}
              </button>
            </div>
            {attachHrMsg && (
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>{attachHrMsg}</span>
            )}
          </div>
        )}
      </section>

      {activity.hrZones && zoneTotal > 0 && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Зоны пульса</h2>
          <div className={s.card}>
            <div className={s.zones}>
              {(
                [
                  ["Разминка",     activity.hrZones.warmUp,    "#bee3f8"],
                  ["Жиросжигание", activity.hrZones.fatBurn,   "#90cdf4"],
                  ["Аэробная",     activity.hrZones.aerobic,   "#63b3ed"],
                  ["Анаэробная",   activity.hrZones.anaerobic, "#3182ce"],
                  ["Максимальная", activity.hrZones.extreme,   "#e53e3e"],
                ] as [string, number, string][]
              ).map(([label, secs, color]) =>
                secs > 0 && (
                  <div key={label} className={s.zone}>
                    <div className={s.zoneName}>{label}</div>
                    <div className={s.zoneBar}>
                      <div className={s.zoneProgress}
                        style={{ width: `${(secs / zoneTotal) * 100}%`, background: color }} />
                    </div>
                    <div className={s.zoneTime}>{fmtDuration(secs)}</div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      )}

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Редактировать</h2>
        <div className={s.card}>
          <EditActivityForm
            activity={activity}
            onSaved={updated => setData(updated)}
            onNeedsRefetch={() => refetch()}
          />
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Скачать</h2>
        <div className={s.downloadRow}>
          {activity.hasTcx && (
            <button className={s.dlBtn} onClick={() => activitiesApi.downloadFile(activity.id, "tcx")}>↓ TCX</button>
          )}
          {activity.hasFit && (
            <button className={s.dlBtn} onClick={() => activitiesApi.downloadFile(activity.id, "fit")}>↓ FIT</button>
          )}
          {!activity.hasTcx && !activity.hasFit && (
            <p className={s.noFiles}>Файлы не найдены. Запустите обработку в разделе «Импорт».</p>
          )}
        </div>
      </section>
    </div>
  );
}

// TanStack Query + возможность локально обновлять данные (для merge-hr и edit form)
function useActivityDetailWithSetter(id: string) {
  const queryClient = useQueryClient();
  const query = useActivityDetail(id);

  const setData = (updater: Activity | ((prev: Activity | undefined) => Activity | undefined)) => {
    queryClient.setQueryData<Activity>(qk.activities.detail(id), updater as any);
  };

  return { ...query, setData, refetch: query.refetch };
}
