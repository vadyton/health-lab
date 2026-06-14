import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import type { ActivityCreateRequest } from "@/entities/activity/model/types";
import { qk } from "@/shared/api/queryKeys";
import { SPORT_OPTIONS } from "@/shared/lib/sportOptions";
import s from "./AddActivityPage.module.scss";

// Sport capability groups (mirrors EditActivityForm)
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

const CADENCE_SPORTS = new Set([
  "outdoor_run", "indoor_run", "not_outdoor_run_class",
  "outdoor_walking", "walking", "race_walking",
  "cycling", "outdoor_riding", "indoor_riding", "spinning", "bmx",
  "rowing", "kayaking",
  "elliptical", "stepper",
  "rope_skipping", "rope_jump",
  "hiking",
]);

const POWER_SPORTS = new Set([
  "cycling", "outdoor_riding", "indoor_riding", "spinning", "bmx",
  "rowing", "kayaking",
]);

const ELEVATION_SPORTS = new Set([
  "outdoor_run",
  "outdoor_walking", "race_walking", "hiking",
  "cycling", "outdoor_riding", "bmx",
  "kayaking", "sailing",
  "ice_skating", "roller_skating", "skateboarding",
  "rock_climbing", "parkour", "cross_training",
]);

const VO2MAX_SPORTS = new Set([
  "outdoor_run", "indoor_run", "not_outdoor_run_class",
  "outdoor_walking", "walking", "race_walking", "hiking",
  "cycling", "outdoor_riding", "indoor_riding", "spinning",
  "swim", "swimming",
  "rowing", "kayaking",
  "elliptical",
  "cross_training", "hiit",
]);

type Status = "idle" | "saving" | "error";

// datetime-local <-> unix seconds (local timezone)
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - 30);
  return toLocalInput(d);
}

function defaultEnd(): string {
  return toLocalInput(new Date());
}

export function AddActivityPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [sport, setSport] = useState(SPORT_OPTIONS[0]?.id ?? "free_training");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [startAt, setStartAt] = useState(defaultStart());
  const [endAt,   setEndAt]   = useState(defaultEnd());

  const [calories,    setCalories]    = useState("");
  const [avgHr,       setAvgHr]       = useState("");
  const [maxHr,       setMaxHr]       = useState("");
  const [trainLoad,   setTrainLoad]   = useState("");
  const [trainEffect, setTrainEffect] = useState("");
  const [recoverTime, setRecoverTime] = useState("");

  const [distanceKm,  setDistanceKm]  = useState("");
  const [avgSpeedKmh, setAvgSpeedKmh] = useState("");
  const [maxSpeedKmh, setMaxSpeedKmh] = useState("");

  const [avgCadence, setAvgCadence] = useState("");
  const [maxCadence, setMaxCadence] = useState("");

  const [avgPower, setAvgPower] = useState("");
  const [maxPower, setMaxPower] = useState("");

  const [totalAscent,  setTotalAscent]  = useState("");
  const [totalDescent, setTotalDescent] = useState("");

  const [vo2Max, setVo2Max] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");

  const canDist      = DIST_SPORTS.has(sport);
  const canCadence   = CADENCE_SPORTS.has(sport);
  const canPower     = POWER_SPORTS.has(sport);
  const canElevation = ELEVATION_SPORTS.has(sport);
  const canVo2max    = VO2MAX_SPORTS.has(sport);

  const num = (v: string) => v === "" ? undefined : Number(v);

  const handleSave = async () => {
    setStatus("saving");
    setErrMsg("");
    try {
      const startTime = fromLocalInput(startAt);
      const endTime   = fromLocalInput(endAt);

      if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        throw new Error("Укажите корректное время начала и окончания");
      }
      if (startTime >= endTime) {
        throw new Error("Время начала должно быть раньше времени окончания");
      }

      const payload: ActivityCreateRequest = {
        sport,
        title: title || undefined,
        notes: notes || undefined,
        startTime,
        endTime,
        calories:     num(calories),
        avgHr:        num(avgHr),
        maxHr:        num(maxHr),
        trainLoad:    num(trainLoad),
        trainEffect:  num(trainEffect),
        recoverTime:  num(recoverTime),
        distanceM:    distanceKm  !== "" ? parseFloat(distanceKm)  * 1000 : undefined,
        avgSpeed:     avgSpeedKmh !== "" ? parseFloat(avgSpeedKmh) / 3.6  : undefined,
        maxSpeed:     maxSpeedKmh !== "" ? parseFloat(maxSpeedKmh) / 3.6  : undefined,
        avgCadence:   num(avgCadence),
        maxCadence:   num(maxCadence),
        avgPower:     num(avgPower),
        maxPower:     num(maxPower),
        totalAscent:  num(totalAscent),
        totalDescent: num(totalDescent),
        vo2Max:       num(vo2Max),
      };

      const created = await activitiesApi.create(payload);
      queryClient.invalidateQueries({ queryKey: qk.activities.all() });
      navigate(`/activity/${created.id}`);
    } catch (e: unknown) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div className={s.page}>
      <div className={s.topBar}>
        <button className={s.back} onClick={() => navigate(-1)}>← Назад</button>
      </div>
      <h1 className={s.title}>Новая активность</h1>

      <div className={s.form}>
        {/* ── Основные ─────────────────────────────────────────────── */}
        <div className={s.field}>
          <label className={s.label}>Вид спорта</label>
          <select className={s.select} value={sport} onChange={(e) => setSport(e.target.value)}>
            {SPORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.icon} {o.label}</option>
            ))}
          </select>
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

        <div className={s.row2}>
          <div className={s.field}>
            <label className={s.label}>Начало</label>
            <input className={s.input} type="datetime-local" value={startAt}
              onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label}>Окончание</label>
            <input className={s.input} type="datetime-local" value={endAt}
              onChange={(e) => setEndAt(e.target.value)} />
          </div>
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
            {status === "saving" ? "Сохранение…" : "Создать активность"}
          </button>
        </div>

        {status === "error" && (
          <div className={s.errorMsg}>Ошибка: {errMsg}</div>
        )}
      </div>
    </div>
  );
}
