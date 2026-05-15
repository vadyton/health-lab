import { useState, useEffect } from "react";
import type { UserProfile } from "@/entities/profile/model/types";
import { profileApi } from "@/entities/profile/api/profileApi";
import { dataManagementApi, SOURCE_LABELS, type SourceStats } from "@/entities/data-management/api/dataManagementApi";
import s from "./ProfilePage.module.scss";

type Field = keyof UserProfile;

interface FieldDef {
  key: Field;
  label: string;
  type: "number" | "text" | "select" | "date";
  unit?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  hint?: string;
}

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Основные данные",
    fields: [
      {
        key: "gender", label: "Пол", type: "select",
        options: [{ value: "male", label: "Мужской" }, { value: "female", label: "Женский" }, { value: "other", label: "Другой" }],
      },
      { key: "dateOfBirth", label: "Дата рождения", type: "date" },
      { key: "height", label: "Рост", type: "number", unit: "см", placeholder: "175" },
      { key: "weight", label: "Вес", type: "number", unit: "кг", placeholder: "70.5" },
    ],
  },
  {
    title: "Сердечная деятельность",
    fields: [
      {
        key: "restingHr", label: "ЧСС покоя", type: "number", unit: "уд/мин",
        placeholder: "60", hint: "Измеряйте утром в расслабленном состоянии",
      },
      {
        key: "maxHr", label: "Максимальная ЧСС", type: "number", unit: "уд/мин",
        placeholder: "190", hint: "Если не задана, рассчитывается как 220 − возраст",
      },
    ],
  },
  {
    title: "Параметры шага",
    fields: [
      {
        key: "walkingStepLength", label: "Длина шага при ходьбе", type: "number", unit: "см",
        placeholder: "75", hint: "Среднее расстояние между стопами при обычном шаге",
      },
      {
        key: "runningStrideLength", label: "Длина беговой связки (2 шага)", type: "number", unit: "см",
        placeholder: "140", hint: "Расстояние, покрытое за один полный цикл бега",
      },
    ],
  },
  {
    title: "Аэробная форма",
    fields: [
      {
        key: "vo2max", label: "VO2max", type: "number", unit: "мл/кг/мин",
        placeholder: "45", hint: "Показатель максимального потребления кислорода",
      },
    ],
  },
];

function fmtN(n: number) { return n.toLocaleString("ru-RU"); }

function DataSourceCard({ source, stats, onDeleted }: {
  source: string;
  stats: SourceStats;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [result,     setResult]     = useState<Record<string, number> | null>(null);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await dataManagementApi.deleteSource(source);
      setResult(res);
      setConfirming(false);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={s.sourceCard}>
      <div className={s.sourceHeader}>
        <span className={s.sourceName}>{SOURCE_LABELS[source] ?? source}</span>
        <span className={s.sourceTotal}>{fmtN(total)} записей</span>
      </div>
      <div className={s.sourceCounts}>
        {Object.entries(stats).map(([key, n]) => n > 0 && (
          <span key={key} className={s.sourceCount}>
            {{heartRate:"Пульс", steps:"Шаги", sleep:"Сон", activities:"Активности", body:"Состав тела"}[key] ?? key}: {fmtN(n)}
          </span>
        ))}
      </div>
      {result && (
        <p className={s.deleteResult}>
          Удалено: {Object.entries(result).map(([k, v]) => `${k} (${fmtN(v)})`).join(", ")}
        </p>
      )}
      {!confirming && !result && total > 0 && (
        <button className={s.deleteBtn} onClick={() => setConfirming(true)}>
          Удалить все данные {SOURCE_LABELS[source] ?? source}
        </button>
      )}
      {confirming && (
        <div className={s.confirmRow}>
          <span className={s.confirmText}>Удалить {fmtN(total)} записей безвозвратно?</span>
          <button className={s.confirmYes} onClick={handleDelete} disabled={deleting}>
            {deleting ? "Удаляем…" : "Да, удалить"}
          </button>
          <button className={s.confirmNo} onClick={() => setConfirming(false)}>Отмена</button>
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile]       = useState<UserProfile>({});
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loading, setLoading]       = useState(true);
  const [sourceStats, setSourceStats] = useState<Record<string, SourceStats> | null>(null);

  const loadSourceStats = () => {
    dataManagementApi.getSourceStats().then(setSourceStats).catch(() => {});
  };

  useEffect(() => {
    profileApi.getProfile().then(p => { setProfile(p); setLoading(false); });
    loadSourceStats();
  }, []);

  const set = (key: Field, value: unknown) => {
    setProfile(p => ({ ...p, [key]: value === "" ? undefined : value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await profileApi.save(profile);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className={s.page}><div className={s.loading}>Загрузка…</div></div>;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h1 className={s.title}>Персональные данные</h1>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Сохраняется…" : saved ? "✓ Сохранено" : "Сохранить"}
        </button>
      </div>
      <p className={s.subtitle}>
        Данные используются для расчёта зон пульса, дистанции и калорий. Заполните те, которые знаете.
      </p>

      {sourceStats && Object.keys(sourceStats).length > 0 && (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Управление данными</h2>
          <div className={s.sourcesGrid}>
            {Object.entries(sourceStats).map(([source, stats]) => (
              <DataSourceCard
                key={source}
                source={source}
                stats={stats}
                onDeleted={loadSourceStats}
              />
            ))}
          </div>
        </section>
      )}

      {SECTIONS.map(section => (
        <section key={section.title} className={s.section}>
          <h2 className={s.sectionTitle}>{section.title}</h2>
          <div className={s.card}>
            {section.fields.map(f => (
              <div key={f.key} className={s.field}>
                <label className={s.label}>{f.label}</label>
                <div className={s.inputWrap}>
                  {f.type === "select" ? (
                    <select
                      className={s.input}
                      value={(profile[f.key] as string) ?? ""}
                      onChange={e => set(f.key, e.target.value || undefined)}
                    >
                      <option value="">— не указан —</option>
                      {f.options!.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "date" ? (
                    <input
                      type="date"
                      className={s.input}
                      value={(profile[f.key] as string) ?? ""}
                      onChange={e => set(f.key, e.target.value || undefined)}
                    />
                  ) : (
                    <input
                      type="number"
                      className={s.input}
                      step="any"
                      placeholder={f.placeholder}
                      value={(profile[f.key] as number | undefined) ?? ""}
                      onChange={e => set(f.key, e.target.value === "" ? undefined : parseFloat(e.target.value))}
                    />
                  )}
                  {f.unit && <span className={s.unit}>{f.unit}</span>}
                </div>
                {f.hint && <div className={s.hint}>{f.hint}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
