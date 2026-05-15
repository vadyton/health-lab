import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/shared/ui/Skeleton";
import s from "./ActivityPage.module.scss";
import sk from "./ActivitySkeleton.module.scss";

export function ActivitySkeleton() {
  const navigate = useNavigate();
  return (
    <div className={s.page}>
      {/* topBar — кнопка «Назад» работает сразу */}
      <div className={s.topBar}>
        <button className={s.back} onClick={() => navigate(-1)}>← Назад</button>
        <Skeleton width="90px" height="32px" className={sk.pill} />
      </div>

      {/* Header */}
      <div className={s.header}>
        <Skeleton width="56px" height="56px" rounded className={sk.icon} />
        <div className={sk.headerText}>
          <Skeleton width="200px" height="26px" />
          <Skeleton width="160px" height="14px" />
        </div>
      </div>

      {/* Stats grid */}
      <div className={`${s.stats} ${sk.stats}`}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={sk.statCard}>
            <Skeleton width="24px" height="24px" className={sk.statIcon} />
            <Skeleton width="70%" height="26px" />
            <Skeleton width="90%" height="12px" />
          </div>
        ))}
      </div>

      {/* Пульс */}
      <section className={s.section}>
        <div className={s.sectionRow}>
          <Skeleton width="60px" height="20px" />
          <Skeleton width="140px" height="32px" className={sk.pill} />
        </div>
        <div className={`${s.card} ${sk.chartCard}`}>
          <Skeleton height="180px" />
        </div>
      </section>

      {/* Зоны пульса */}
      <section className={s.section}>
        <Skeleton width="120px" height="20px" className={sk.sectionTitle} />
        <div className={`${s.card} ${sk.zonesCard}`}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={sk.zoneRow}>
              <Skeleton width="100px" height="13px" />
              <Skeleton height="8px" />
              <Skeleton width="44px" height="13px" />
            </div>
          ))}
        </div>
      </section>

      {/* Редактировать */}
      <section className={s.section}>
        <Skeleton width="110px" height="20px" className={sk.sectionTitle} />
        <div className={`${s.card} ${sk.formCard}`}>
          {[1, 2, 3].map(i => (
            <div key={i} className={sk.formRow}>
              <Skeleton width="80px" height="11px" />
              <Skeleton height="36px" />
            </div>
          ))}
          <div className={sk.numGrid}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={sk.formRow}>
                <Skeleton width="70px" height="11px" />
                <Skeleton height="36px" />
              </div>
            ))}
          </div>
          <Skeleton width="240px" height="40px" className={sk.pill} />
        </div>
      </section>

      {/* Скачать */}
      <section className={s.section}>
        <Skeleton width="75px" height="20px" className={sk.sectionTitle} />
        <div className={s.downloadRow}>
          <Skeleton width="90px" height="40px" className={sk.pill} />
          <Skeleton width="90px" height="40px" className={sk.pill} />
        </div>
      </section>
    </div>
  );
}
