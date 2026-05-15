import { Skeleton, SkeletonCard } from "@/shared/ui/Skeleton";
import s from "./SleepPage.module.scss";
import sk from "./SleepSkeleton.module.scss";

export function SleepSkeleton() {
  return (
    <div className={s.page}>
      <div className={s.topRow}>
        <Skeleton width="100px" height="28px" />
        <div className={sk.tabs}>
          {[1, 2, 3].map(i => <Skeleton key={i} width="72px" height="32px" className={sk.tab} />)}
        </div>
      </div>

      {/* Stats */}
      <div className={s.statsGrid}>
        {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
      </div>

      {/* Insight pills */}
      <div className={sk.insights}>
        <Skeleton width="260px" height="32px" className={sk.pill} />
        <Skeleton width="200px" height="32px" className={sk.pill} />
      </div>

      {/* Chart */}
      <div className={s.chartCard}>
        <div className={s.chartHeader}>
          <Skeleton width="100px" height="16px" />
          <div className={sk.legend}>
            {[1, 2, 3].map(i => <Skeleton key={i} width="70px" height="12px" />)}
          </div>
        </div>
        <Skeleton height="200px" />
      </div>

      {/* Calendar + detail */}
      <div className={s.layout}>
        <div className={sk.calendar}>
          <div className={sk.calHeader}>
            <Skeleton width="24px" height="28px" />
            <Skeleton width="120px" height="18px" />
            <Skeleton width="24px" height="28px" />
          </div>
          <div className={sk.calGrid}>
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} height="44px" />
            ))}
          </div>
        </div>

        <div className={sk.detail}>
          <Skeleton width="150px" height="22px" />
          <Skeleton width="100px" height="14px" />
          <div className={sk.detailStats}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={sk.ds}>
                <Skeleton height="28px" width="80%" />
                <Skeleton height="11px" width="60%" />
              </div>
            ))}
          </div>
          <Skeleton height="24px" />
        </div>
      </div>
    </div>
  );
}
