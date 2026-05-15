import { Skeleton, SkeletonCard } from "@/shared/ui/Skeleton";
import sk from "./StepsSkeleton.module.scss";

export function StepsSkeleton() {
  return (
    <div className={sk.page}>
      <Skeleton width="70px" height="28px" />

      <div className={sk.controls}>
        <div className={sk.seg}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} width="64px" height="34px" className={sk.segBtn} />)}
        </div>
        <div className={sk.dateNav}>
          <Skeleton width="32px" height="34px" />
          <Skeleton width="140px" height="34px" />
          <Skeleton width="32px" height="34px" />
        </div>
        <Skeleton width="100px" height="34px" className={sk.compareBtn} />
      </div>

      <div className={sk.stats}>
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>

      <div className={sk.chartCard}>
        <Skeleton height="240px" />
      </div>
    </div>
  );
}
