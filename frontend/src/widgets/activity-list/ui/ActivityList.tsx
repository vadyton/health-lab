import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "@/entities/activity/model/types";
import { sportLabel, sportIcon } from "@/shared/lib/sportLabels";
import { fmtDate, fmtDuration } from "@/shared/lib/formatters";
import { Spinner } from "@/shared/ui/Spinner";
import s from "./ActivityList.module.scss";

interface Props {
  activities: Activity[];
  filterDate?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

export function ActivityList({ activities, filterDate, hasMore, loadingMore, onLoadMore }: Props) {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore(); },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  const filtered = filterDate
    ? activities.filter(a => new Date(a.start * 1000).toISOString().slice(0, 10) === filterDate)
    : activities;

  if (!filtered.length) {
    return (
      <div className={s.empty}>
        {filterDate ? "Нет активностей в этот день" : "Нет данных. Загрузите данные Mi Fitness."}
      </div>
    );
  }

  return (
    <div className={s.list}>
      {filtered.map((a) => (
        <button
          key={a.id}
          className={s.item}
          onClick={() => navigate(`/activity/${a.id}`)}
        >
          <span className={s.icon}>{sportIcon(a.category)}</span>
          <div className={s.main}>
            <div className={s.name}>{a.title ?? sportLabel(a.category)}</div>
            <div className={s.date}>{fmtDate(a.start)}</div>
          </div>
          <div className={s.stats}>
            <span className={s.stat}>{fmtDuration(a.duration)}</span>
            {a.calories > 0 && (
              <span className={s.stat}>{Math.round(a.calories)} ккал</span>
            )}
            {(a.avgHr ?? 0) > 0 ? (
              <span className={s.statHr}>❤️ {Math.round(a.avgHr!)} уд/мин</span>
            ) : null}
          </div>
          <span className={s.arrow}>›</span>
        </button>
      ))}

      {hasMore && !filterDate && (
        <div ref={sentinelRef} className={s.sentinel}>
          {loadingMore && <Spinner size={20} />}
        </div>
      )}
    </div>
  );
}
