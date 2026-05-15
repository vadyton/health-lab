import { useState } from "react";
import { SqliteDropzone } from "@/features/upload-data/ui/SqliteDropzone";
import { FileDropzone } from "@/features/upload-data/ui/FileDropzone";
import { FitTcxDropzone } from "@/features/upload-data/ui/FitTcxDropzone";
import { ZeppLifeDropzone } from "@/features/upload-data/ui/ZeppLifeDropzone";
import { ProcessPanel } from "@/features/process-data/ui/ProcessPanel";
import s from "./ImportPage.module.scss";

type Source = "sqlite" | "mifitness" | "zepp" | "fitcx";

const SOURCES: { id: Source; label: string; badge?: string }[] = [
  { id: "sqlite",    label: "Mi Fitness DB", badge: "Рекомендуется" },
  { id: "mifitness", label: "Mi Fitness CSV" },
  { id: "zepp",      label: "Zepp Life"       },
  { id: "fitcx",     label: "FIT / TCX"       },
];

export function ImportPage() {
  const [source, setSource] = useState<Source>("sqlite");

  return (
    <div className={s.page}>
      <h1 className={s.title}>Импорт данных</h1>

      <div className={s.sourceSeg}>
        {SOURCES.map(src => (
          <button
            key={src.id}
            className={`${s.sourceBtn} ${source === src.id ? s.active : ""}`}
            onClick={() => setSource(src.id)}
          >
            {src.label}
            {src.badge && <span className={s.badge}>{src.badge}</span>}
          </button>
        ))}
      </div>

      {source === "sqlite" && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Импорт из базы данных Mi Fitness</h2>
          <p className={s.hint}>
            Наиболее полный способ импорта. Файл базы данных содержит всю историю —
            пульс, SpO2, шаги, сон и активности — с максимальной точностью.
            Найти файл: iPhone → Файлы → На моём iPhone → Mi Fitness → database → *.db.
            Дубликаты автоматически пропускаются — загружать можно повторно.
          </p>
          <SqliteDropzone />
        </section>
      )}

      {source === "mifitness" && (
        <>
          <section className={s.section}>
            <h2 className={s.sectionTitle}>1. Загрузите CSV-файлы из Mi Fitness</h2>
            <p className={s.hint}>
              Запросите экспорт в приложении Mi Fitness → Профиль → Настройки →
              Конфиденциальность → Экспорт данных. Когда архив будет готов —
              перетащите все CSV-файлы сюда.
            </p>
            <FileDropzone onUploaded={() => {}} />
          </section>

          <section className={s.section}>
            <h2 className={s.sectionTitle}>2. Обработайте данные</h2>
            <p className={s.hint}>
              Запустите обработку — добавятся только новые активности, пульс, сон и шаги.
            </p>
            <ProcessPanel />
          </section>
        </>
      )}

      {source === "zepp" && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Импорт из Zepp Life</h2>
          <p className={s.hint}>
            Как получить архив: Zepp Life → Профиль → Настройки → Безопасность и конфиденциальность
            персональной информации → Осуществление прав пользователей → Экспорт данных →
            выберите нужные данные → укажите email → получите письмо со ссылкой → скачайте архив.
            Пароль от архива придёт в том же письме. Импортируются: пульс, шаги, сон,
            тренировки, вес и состав тела.
          </p>
          <ZeppLifeDropzone />
        </section>
      )}

      {source === "fitcx" && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Загрузите файлы активностей</h2>
          <p className={s.hint}>
            Поддерживаются файлы .fit и .tcx из Garmin, Polar, Apple Health и других
            устройств. Дубликаты определяются по времени начала и пропускаются.
          </p>
          <FitTcxDropzone />
        </section>
      )}
    </div>
  );
}
