import { Skeleton, SkeletonCard } from "@/shared/ui/Skeleton";
import s from "./DashboardPage.module.scss";
import sk from "./DashboardSkeleton.module.scss";

export function DashboardSkeleton() {
  return (
    <div className={s.page}>
      <div className={s.top}>
        <Skeleton width="120px" height="28px" />
        <Skeleton width="40px" height="22px" className={sk.pill} />
      </div>

      {/* Stats row */}
      <div className={s.statsRow}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>

      <div className={s.layout}>
        {/* Calendar skeleton */}
        <div className={sk.calendar}>
          <div className={sk.calendarHeader}>
            <Skeleton width="24px" height="28px" />
            <Skeleton width="120px" height="18px" />
            <Skeleton width="24px" height="28px" />
          </div>
          <div className={sk.calendarGrid}>
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} height="40px" />
            ))}
          </div>
        </div>

        {/* List skeleton */}
        <div className={sk.list}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={sk.listItem}>
              <Skeleton width="40px" height="40px" rounded />
              <div className={sk.listItemContent}>
                <Skeleton height="16px" width="60%" />
                <Skeleton height="12px" width="40%" />
              </div>
              <Skeleton width="80px" height="14px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
