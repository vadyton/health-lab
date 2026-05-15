import type { SleepRecord } from "@/entities/sleep/model/types";
import { fmtTime, fmtSleepDuration } from "@/shared/lib/formatters";
import s from "./SleepChart.module.scss";

interface StageBarProps {
  record: SleepRecord;
}

const STATE_COLOR: Record<string, string> = {
  deep: "#2b6cb0",
  light: "#90cdf4",
  rem: "#805ad5",
  awake: "#fed7d7",
};
const STATE_LABEL: Record<string, string> = {
  deep: "Глубокий",
  light: "Лёгкий",
  rem: "REM",
  awake: "Пробуждение",
};

export function SleepStageBar({ record }: StageBarProps) {
  if (!record.stages?.length) {
    return <div className={s.noStages}>Нет данных по фазам</div>;
  }

  const total = record.wakeUpTime - record.bedtime;

  return (
    <div className={s.stageBar}>
      <div className={s.timeRow}>
        <span>{fmtTime(record.bedtime)}</span>
        <span>{fmtTime(record.wakeUpTime)}</span>
      </div>
      <div className={s.bar}>
        {record.stages.map((stage, i) => {
          const dur = stage.end - stage.start;
          const pct = (dur / total) * 100;
          return (
            <div
              key={i}
              className={s.segment}
              style={{
                width: `${pct}%`,
                background: STATE_COLOR[stage.state],
              }}
              title={`${STATE_LABEL[stage.state]}: ${fmtSleepDuration(Math.round(dur / 60))}`}
            />
          );
        })}
      </div>
      <div className={s.legend}>
        {Object.entries(STATE_COLOR).map(([state, color]) => (
          <span key={state} className={s.legendItem}>
            <span className={s.legendDot} style={{ background: color }} />
            {STATE_LABEL[state]}
          </span>
        ))}
      </div>
    </div>
  );
}

interface DurationBarProps {
  deep: number;
  light: number;
  rem: number;
  total: number;
}

export function SleepDurationBar({ deep, light, rem, total }: DurationBarProps) {
  const pct = (v: number) => total > 0 ? `${((v / total) * 100).toFixed(0)}%` : "0%";
  return (
    <div className={s.durationBar}>
      <div className={s.durationRow} style={{ background: STATE_COLOR.deep, width: pct(deep) }}>
        {deep > 0 && <span>{fmtSleepDuration(deep)}</span>}
      </div>
      <div className={s.durationRow} style={{ background: STATE_COLOR.rem, width: pct(rem) }}>
        {rem > 0 && <span>{fmtSleepDuration(rem)}</span>}
      </div>
      <div className={s.durationRow} style={{ background: STATE_COLOR.light, width: pct(light) }}>
        {light > 0 && <span>{fmtSleepDuration(light)}</span>}
      </div>
    </div>
  );
}
