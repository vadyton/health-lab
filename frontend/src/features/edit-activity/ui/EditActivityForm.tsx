import { useState, useCallback } from "react";
import type { Activity, ActivityFileEdit } from "@/entities/activity/model/types";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import { SPORT_OPTIONS } from "@/shared/lib/sportOptions";
import { TrimSlider } from "./TrimSlider";
import s from "./EditActivityForm.module.scss";

interface Props {
  activity: Activity;
  onSaved: (updated: Activity) => void;
  onNeedsRefetch?: () => void;
}

type Status = "idle" | "saving" | "done" | "error";

// Sport capability groups
// Distance + speed: любой вид спорта с перемещением в пространстве
const DIST_SPORTS = new Set([
  "outdoor_run", "indoor_run", "not_outdoor_run_class",
  "outdoor_walking", "walking", "race_walking",
  "cycling", "outdoor_riding", "indoor_riding", "spinning", "bmx",
  "swim", "swimming",
  "rowing", "kayaking", "sailing",
  "elliptical",
  "hiking", "parkour", "cross_training",
  "ice_skating", "roller_skating", "skateboarding",
  "football", "basketball", "tennis", "volleyball", "handball", "badminton", "squash",
  "aerobics", "hiit", "free_training",
]);

// Каденс: шаги/об.мин
const CADENCE_SPORTS = new Set([
  "outdoor_run", "indoor_run", "not_outdoor_run_class",
  "outdoor_walking", "walking", "race_walking",
  "cycling", "outdoor_riding", "indoor_riding", "spinning", "bmx",
  "rowing", "kayaking",
  "elliptical", "stepper",
  "rope_skipping", "rope_jump",
  "hiking",
]);

// Мощность (Вт): велоспорт и гребля
const POWER_SPORTS = new Set([
  "cycling", "outdoor_riding", "indoor_riding", "spinning", "bmx",
  "rowing", "kayaking",
]);

// Набор/потеря высоты: уличные виды
const ELEVATION_SPORTS = new Set([
  "outdoor_run",
  "outdoor_walking", "race_walking", "hiking",
  "cycling", "outdoor_riding", "bmx",
  "kayaking", "sailing",
  "ice_skating", "roller_skating", "skateboarding",
  "rock_climbing", "parkour", "cross_training",
]);

// VO₂ Max: аэробные виды
const VO2MAX_SPORTS = new Set([
  "outdoor_run", "indoor_run", "not_outdoor_run_class",
  "outdoor_walking", "walking", "race_walking", "hiking",
  "cycling", "outdoor_riding", "indoor_riding", "spinning",
  "swim", "swimming",
  "rowing", "kayaking",
  "elliptical",
  "cross_training", "hiit",
]);

// Stored in m/s → display km/h; stored in m → display km
const mToKm   = (m?: number | null)  => (m != null && m > 0) ? (m / 1000).toFixed(3) : "";
const msToKmh = (ms?: number | null) => (ms != null && ms > 0) ? (ms * 3.6).toFixed(2) : "";
const numStr  = (v?: number | null)  => (v != null && v > 0) ? String(v) : "";

export function EditActivityForm({ activity, onSaved, onNeedsRefetch }: Props) {
  const ov = activity.overrides ?? {};

  const [sport,        setSport]        = useState(ov.sport        ?? activity.categoryOriginal);
  const [title,        setTitle]        = useState(ov.title        ?? activity.title ?? "");
  const [notes,        setNotes]        = useState(ov.notes        ?? activity.notes ?? "");

  // Core metrics
  const [calories,     setCalories]     = useState(numStr(ov.calories    ?? activity.calories));
  const [avgHr,        setAvgHr]        = useState(numStr(ov.avgHr       ?? activity.avgHr));
  const [maxHr,        setMaxHr]        = useState(numStr(ov.maxHr       ?? activity.maxHr));
  const [trainLoad,    setTrainLoad]    = useState(numStr(ov.trainLoad   ?? activity.trainLoad));
  const [trainEffect,  setTrainEffect]  = useState(numStr(ov.trainEffect ?? activity.trainEffect));
  const [recoverTime,  setRecoverTime]  = useState(numStr(ov.recoverTime ?? activity.recoverTime));

  // Distance & speed (user-facing units: km, km/h)
  const [distanceKm,  setDistanceKm]  = useState(mToKm(ov.distanceM  ?? activity.distanceM));
  const [avgSpeedKmh, setAvgSpeedKmh] = useState(msToKmh(ov.avgSpeed  ?? activity.avgSpeed));
  const [maxSpeedKmh, setMaxSpeedKmh] = useState(msToKmh(ov.maxSpeed  ?? activity.maxSpeed));

  // Cadence
  const [avgCadence,  setAvgCadence]  = useState(numStr(ov.avgCadence  ?? activity.avgCadence));
  const [maxCadence,  setMaxCadence]  = useState(numStr(ov.maxCadence  ?? activity.maxCadence));

  // Power
  const [avgPower,    setAvgPower]    = useState(numStr(ov.avgPower    ?? activity.avgPower));
  const [maxPower,    setMaxPower]    = useState(numStr(ov.maxPower    ?? activity.maxPower));

  // Elevation
  const [totalAscent,  setTotalAscent]  = useState(numStr(ov.totalAscent  ?? activity.totalAscent));
  const [totalDescent, setTotalDescent] = useState(numStr(ov.totalDescent ?? activity.totalDescent));

  // VO2 Max
  const [vo2Max, setVo2Max] = useState(numStr(ov.vo2Max ?? activity.vo2Max));

  const origDuration = activity.end - activity.start;
  const [startOff, setStartOff] = useState(() => {
    if (ov.startTime != null) return ov.startTime - activity.start;
    return 0;
  });
  const [endOff, setEndOff] = useState(() => {
    if (ov.endTime != null) return ov.endTime - activity.end;
    return 0;
  });
  const handleTrimChange = useCallback((s: number, e: number) => {
    setStartOff(s);
    setEndOff(e);
  }, []);

  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [hasTcx, setHasTcx] = useState(activity.hasTcx ?? false);
  const [hasFit, setHasFit] = useState(activity.hasFit ?? false);

  // Sport capability flags — reactive to sport selector.
  // Fallback: если данные уже есть в активности — поле всегда доступно,
  // даже если вид спорта не в списке (данные пришли с устройства).
  const canDist      = DIST_SPORTS.has(sport)      || (activity.distanceM   ?? 0) > 0 || (activity.avgSpeed  ?? 0) > 0;
  const canCadence   = CADENCE_SPORTS.has(sport)   || (activity.avgCadence  ?? 0) > 0;
  const canPower     = POWER_SPORTS.has(sport)     || (activity.avgPower    ?? 0) > 0;
  const canElevation = ELEVATION_SPORTS.has(sport) || (activity.totalAscent ?? 0) > 0;
  const canVo2max    = VO2MAX_SPORTS.has(sport)    || (activity.vo2Max      ?? 0) > 0;

  const num = (v: string) => v === "" ? undefined : Number(v);

  const handleSave = async () => {
    setStatus("saving");
    setErrMsg("");
    try {
      const newStart = startOff !== 0 ? activity.start + startOff : undefined;
      const newEnd   = endOff   !== 0 ? activity.end   + endOff   : undefined;
      const patch: ActivityFileEdit = {
        sport:        sport !== activity.categoryOriginal ? sport : undefined,
        title:        title   || undefined,
        notes:        notes   || undefined,
        startTime:    newStart,
        endTime:      newEnd,
        calories:     num(calories),
        avgHr:        num(avgHr),
        maxHr:        num(maxHr),
        trainLoad:    num(trainLoad),
        trainEffect:  num(trainEffect),
        recoverTime:  num(recoverTime),
        distanceM:    distanceKm !== "" ? parseFloat(distanceKm) * 1000 : undefined,
        avgSpeed:     avgSpeedKmh !== "" ? parseFloat(avgSpeedKmh) / 3.6 : undefined,
        maxSpeed:     maxSpeedKmh !== "" ? parseFloat(maxSpeedKmh) / 3.6 : undefined,
        avgCadence:   num(avgCadence),
        maxCadence:   num(maxCadence),
        avgPower:     num(avgPower),
        maxPower:     num(maxPower),
        totalAscent:  num(totalAscent),
        totalDescent: num(totalDescent),
        vo2Max:       num(vo2Max),
      };

      const result = await activitiesApi.fileEdit(activity.id, patch);
      setHasTcx(result.hasTcx);
      setHasFit(result.hasFit);
      setStatus("done");

      const savedStart    = patch.startTime ?? activity.start;
      const savedEnd      = patch.endTime   ?? activity.end;
      onSaved({
        ...activity,
        category:     patch.sport ?? activity.category,
        title:        patch.title,
        notes:        patch.notes,
        start:        savedStart,
        end:          savedEnd,
        duration:     savedEnd - savedStart,
        calories:     patch.calories     ?? activity.calories,
        avgHr:        patch.avgHr        ?? activity.avgHr,
        maxHr:        patch.maxHr        ?? activity.maxHr,
        trainLoad:    patch.trainLoad    ?? activity.trainLoad,
        trainEffect:  patch.trainEffect  ?? activity.trainEffect,
        recoverTime:  patch.recoverTime  ?? activity.recoverTime,
        distanceM:    patch.distanceM    ?? activity.distanceM,
        avgSpeed:     patch.avgSpeed     ?? activity.avgSpeed,
        maxSpeed:     patch.maxSpeed     ?? activity.maxSpeed,
        avgCadence:   patch.avgCadence   ?? activity.avgCadence,
        maxCadence:   patch.maxCadence   ?? activity.maxCadence,
        avgPower:     patch.avgPower     ?? activity.avgPower,
        maxPower:     patch.maxPower     ?? activity.maxPower,
        totalAscent:  patch.totalAscent  ?? activity.totalAscent,
        totalDescent: patch.totalDescent ?? activity.totalDescent,
        vo2Max:       patch.vo2Max       ?? activity.vo2Max,
        hasTcx:       result.hasTcx,
        hasFit:       result.hasFit,
        overrides:    patch,
      });

      // HR/GPS samples are trimmed server-side — need a full refetch to reflect them
      if (patch.startTime != null || patch.endTime != null) {
        onNeedsRefetch?.();
      }

      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div className={s.form}>
      {/* ── Основные ─────────────────────────────────────────────── */}
      <div className={s.field}>
        <label className={s.label}>Вид спорта</label>
        <select className={s.select} value={sport} onChange={(e) => setSport(e.target.value)}>
          {SPORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.icon} {o.label}</option>
          ))}
        </select>
        {sport !== activity.categoryOriginal && (
          <span className={s.originalHint}>Оригинал: {activity.categoryOriginal}</span>
        )}
      </div>

      <div className={s.field}>
        <label className={s.label}>Название</label>
        <input className={s.input} type="text" value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder="Например: Утренняя тренировка" />
      </div>

      <div className={s.field}>
        <label className={s.label}>Заметки</label>
        <textarea className={s.textarea} value={notes} rows={2}
          onChange={(e) => setNotes(e.target.value)} placeholder="Описание тренировки…" />
      </div>

      <div className={s.field}>
        <label className={s.label}>Обрезать тренировку</label>
        <TrimSlider
          totalSec={origDuration}
          startOff={startOff}
          endOff={endOff}
          onChange={handleTrimChange}
        />
      </div>

      {/* ── Метрики ──────────────────────────────────────────────── */}
      <div className={s.numGrid}>
        <div className={s.field}>
          <label className={s.label}>Калории</label>
          <input className={s.numInput} type="number" min="0" value={calories}
            onChange={(e) => setCalories(e.target.value)} placeholder="ккал" />
        </div>
        <div className={s.field}>
          <label className={s.label}>Ср. пульс</label>
          <input className={s.numInput} type="number" min="0" max="250" value={avgHr}
            onChange={(e) => setAvgHr(e.target.value)} placeholder="уд/мин" />
        </div>
        <div className={s.field}>
          <label className={s.label}>Макс. пульс</label>
          <input className={s.numInput} type="number" min="0" max="250" value={maxHr}
            onChange={(e) => setMaxHr(e.target.value)} placeholder="уд/мин" />
        </div>
        <div className={s.field}>
          <label className={s.label}>Нагрузка</label>
          <input className={s.numInput} type="number" min="0" value={trainLoad}
            onChange={(e) => setTrainLoad(e.target.value)} placeholder="баллы" />
        </div>
        <div className={s.field}>
          <label className={s.label}>Эффект (0–10)</label>
          <input className={s.numInput} type="number" min="0" max="10" step="0.1" value={trainEffect}
            onChange={(e) => setTrainEffect(e.target.value)} placeholder="0.0" />
        </div>
        <div className={s.field}>
          <label className={s.label}>Восстановление</label>
          <input className={s.numInput} type="number" min="0" value={recoverTime}
            onChange={(e) => setRecoverTime(e.target.value)} placeholder="мин" />
        </div>
      </div>

      {/* ── Дистанция и скорость ─────────────────────────────────── */}
      <div className={`${s.section} ${!canDist ? s.sectionDisabled : ""}`}>
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>Дистанция и скорость</span>
          {!canDist && <span className={s.sectionHint}>Недоступно для выбранного вида спорта</span>}
        </div>
        <div className={s.numGrid}>
          <div className={s.field}>
            <label className={s.label}>Дистанция</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" step="0.001" value={distanceKm}
                disabled={!canDist} onChange={(e) => setDistanceKm(e.target.value)} placeholder="0.000" />
              <span className={s.unit}>км</span>
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label}>Ср. скорость</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" step="0.01" value={avgSpeedKmh}
                disabled={!canDist} onChange={(e) => setAvgSpeedKmh(e.target.value)} placeholder="0.00" />
              <span className={s.unit}>км/ч</span>
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label}>Макс. скорость</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" step="0.01" value={maxSpeedKmh}
                disabled={!canDist} onChange={(e) => setMaxSpeedKmh(e.target.value)} placeholder="0.00" />
              <span className={s.unit}>км/ч</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Каденс ───────────────────────────────────────────────── */}
      <div className={`${s.section} ${!canCadence ? s.sectionDisabled : ""}`}>
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>Каденс</span>
          {!canCadence && <span className={s.sectionHint}>Недоступно для выбранного вида спорта</span>}
        </div>
        <div className={s.numGrid}>
          <div className={s.field}>
            <label className={s.label}>Средний</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" value={avgCadence}
                disabled={!canCadence} onChange={(e) => setAvgCadence(e.target.value)} placeholder="шаг/мин" />
              <span className={s.unit}>шаг/мин</span>
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label}>Максимальный</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" value={maxCadence}
                disabled={!canCadence} onChange={(e) => setMaxCadence(e.target.value)} placeholder="шаг/мин" />
              <span className={s.unit}>шаг/мин</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Мощность ─────────────────────────────────────────────── */}
      <div className={`${s.section} ${!canPower ? s.sectionDisabled : ""}`}>
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>Мощность</span>
          {!canPower && <span className={s.sectionHint}>Только для велоспорта и гребли</span>}
        </div>
        <div className={s.numGrid}>
          <div className={s.field}>
            <label className={s.label}>Средняя</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" value={avgPower}
                disabled={!canPower} onChange={(e) => setAvgPower(e.target.value)} placeholder="0" />
              <span className={s.unit}>Вт</span>
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label}>Максимальная</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" value={maxPower}
                disabled={!canPower} onChange={(e) => setMaxPower(e.target.value)} placeholder="0" />
              <span className={s.unit}>Вт</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Высота ───────────────────────────────────────────────── */}
      <div className={`${s.section} ${!canElevation ? s.sectionDisabled : ""}`}>
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>Набор высоты</span>
          {!canElevation && <span className={s.sectionHint}>Только для бега и велоспорта на улице</span>}
        </div>
        <div className={s.numGrid}>
          <div className={s.field}>
            <label className={s.label}>Набор</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" value={totalAscent}
                disabled={!canElevation} onChange={(e) => setTotalAscent(e.target.value)} placeholder="0" />
              <span className={s.unit}>м</span>
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label}>Потеря</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" value={totalDescent}
                disabled={!canElevation} onChange={(e) => setTotalDescent(e.target.value)} placeholder="0" />
              <span className={s.unit}>м</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── VO2 Max ──────────────────────────────────────────────── */}
      <div className={`${s.section} ${!canVo2max ? s.sectionDisabled : ""}`}>
        <div className={s.sectionHead}>
          <span className={s.sectionTitle}>VO₂ Max</span>
          {!canVo2max && <span className={s.sectionHint}>Только для бега и аэробных видов спорта</span>}
        </div>
        <div className={s.numGridNarrow}>
          <div className={s.field}>
            <label className={s.label}>VO₂ Max</label>
            <div className={s.inputWrap}>
              <input className={s.numInput} type="number" min="0" max="100" step="0.1" value={vo2Max}
                disabled={!canVo2max} onChange={(e) => setVo2Max(e.target.value)} placeholder="0.0" />
              <span className={s.unit}>мл/кг/мин</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Действия ─────────────────────────────────────────────── */}
      <div className={s.actions}>
        <button className={s.btn} onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Сохранение и генерация файлов…" :
           status === "done"   ? "✓ Файлы обновлены" :
                                 "Сохранить и обновить файлы"}
        </button>
      </div>

      {status === "error" && (
        <div className={s.errorMsg}>Ошибка: {errMsg}</div>
      )}

      <p className={s.hint}>
        Изменения применяются напрямую к файлам TCX и FIT.
        {hasTcx || hasFit
          ? " Файлы готовы для скачивания ниже."
          : " После сохранения — файлы появятся для скачивания."}
      </p>
    </div>
  );
}
