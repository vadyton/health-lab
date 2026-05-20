import Database from "better-sqlite3";
import { HeartRateService } from "../../health/heart-rate/heart-rate.service";
import { Spo2Service } from "../../health/spo2/spo2.service";
import { StepsService } from "../../health/steps/steps.service";
import { SleepService } from "../../health/sleep/sleep.service";
import { ActivitiesService } from "../../activities/activities.service";

export interface ProgressEvent {
  step: string;
  label: string;
  current: number;
  total: number;
  message?: string;
}

type ProgressCallback = (event: ProgressEvent) => void;

interface RawRow {
  key: string;
  time: number;
  value: string;
}

interface SleepJson {
  bedtime?: number;
  wake_up_time?: number;
  duration?: number;
  sleep_deep_duration?: number;
  sleep_light_duration?: number;
  sleep_rem_duration?: number;
  sleep_awake_duration?: number;
  awake_count?: number;
  avg_hr?: number;
  min_hr?: number;
  max_hr?: number;
  avg_spo2?: number;
  min_spo2?: number;
  score?: number;
  avg_breath?: number;
  breath_quality?: number;
  items?: Array<{ start_time: number; end_time: number; state: number }>;
}

interface SportJson {
  start_time?: number;
  end_time?: number;
  duration?: number;
  calories?: number;
  total_cal?: number;
  avg_hrm?: number;
  max_hrm?: number;
  min_hrm?: number;
  train_load?: number;
  train_effect?: number;
  train_load_level?: number;
  recover_time?: number;
  vo2_max?: number;
  hrm_warm_up_duration?: number;
  hrm_fat_burning_duration?: number;
  hrm_aerobic_duration?: number;
  hrm_anaerobic_duration?: number;
  hrm_extreme_duration?: number;
  [key: string]: unknown;
}

const STATE_MAP: Record<number, string> = { 2: "light", 3: "deep", 4: "rem", 5: "awake" };

const NAP_MAX_MIN = 180;

interface NapEntry {
  start: number;
  end: number;
  durationMin?: number;
  deepMin?: number;
  lightMin?: number;
  remMin?: number;
  awakeMin?: number;
  stages?: { start: number; end: number; state: string }[];
}

type SleepRec = {
  bedtime: Date; wakeUp: Date;
  durationMin?: number; deepMin?: number; lightMin?: number;
  remMin?: number; awakeMin?: number; awakeCount?: number;
  avgHr?: number; minHr?: number; maxHr?: number;
  score?: number; avgBreath?: number;
  stages?: { start: number; end: number; state: string }[];
  naps?: NapEntry[];
};

export class SqliteMiFitnessStrategy {
  constructor(
    private readonly heartRateService: HeartRateService,
    private readonly spo2Service: Spo2Service,
    private readonly stepsService: StepsService,
    private readonly sleepService: SleepService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async import(filePath: string, userId: string, onProgress: ProgressCallback): Promise<Record<string, number>> {
    const db = new Database(filePath, { readonly: true });
    const stats: Record<string, number> = {};

    try {
      // No timestamp pre-filtering: always upsert all records so historical
      // backfills (gaps filled in a newer export) are never skipped.
      // Deduplication is handled by unique constraints in the DB via upsert.
      stats.heartRate  = await this.importHeartRate(db, userId, onProgress);
      stats.spo2       = await this.importSpo2(db, userId, onProgress);
      stats.steps      = await this.importSteps(db, userId, onProgress);
      stats.sleep      = await this.importSleep(db, userId, onProgress);
      stats.activities = await this.importActivities(db, userId, onProgress);
      stats.activityHr = await this.activitiesService.linkHeartRateFromGlobal(userId);
    } finally {
      db.close();
    }

    return stats;
  }

  private async importHeartRate(db: Database.Database, userId: string, onProgress: ProgressCallback): Promise<number> {
    const rows = db.prepare(
      "SELECT time, value FROM heart_rate WHERE deleted=0 ORDER BY time"
    ).all() as { time: number; value: string }[];

    const samples = rows.flatMap(r => {
      try {
        const v = JSON.parse(r.value) as { time?: number; bpm?: number };
        const bpm = v.bpm;
        if (!bpm || bpm <= 0) return [];
        return [{ ts: new Date((v.time ?? r.time) * 1000), bpm }];
      } catch { return []; }
    });

    onProgress({ step: "heartRate", label: "Пульс", current: 0, total: samples.length });
    return this.heartRateService.upsertBatch(userId, samples,
      (done, total) => onProgress({ step: "heartRate", label: "Пульс", current: done, total }),
      "mi_fitness",
    );
  }

  private async importSpo2(db: Database.Database, userId: string, onProgress: ProgressCallback): Promise<number> {
    const rows = db.prepare(
      "SELECT time, value FROM spo2 WHERE deleted=0 ORDER BY time"
    ).all() as { time: number; value: string }[];

    const samples = rows.flatMap(r => {
      try {
        const v = JSON.parse(r.value) as { time?: number; spo2?: number };
        const val = v.spo2;
        if (!val || val <= 0) return [];
        return [{ ts: new Date((v.time ?? r.time) * 1000), value: val }];
      } catch { return []; }
    });

    onProgress({ step: "spo2", label: "SpO2", current: 0, total: samples.length });
    return this.spo2Service.upsertBatch(userId, samples,
      (done, total) => onProgress({ step: "spo2", label: "SpO2", current: done, total }),
    );
  }

  private async importSteps(db: Database.Database, userId: string, onProgress: ProgressCallback): Promise<number> {
    const rows = db.prepare(
      "SELECT time, value FROM steps WHERE deleted=0 ORDER BY time"
    ).all() as { time: number; value: string }[];

    const samples = rows.flatMap(r => {
      try {
        const v = JSON.parse(r.value) as { time?: number; steps?: number; distance?: number; calories?: number };
        if (!v.steps) return [];
        return [{ ts: new Date((v.time ?? r.time) * 1000), steps: v.steps, distanceM: v.distance, calories: v.calories }];
      } catch { return []; }
    });

    onProgress({ step: "steps", label: "Шаги", current: 0, total: samples.length });
    return this.stepsService.upsertBatch(userId, samples,
      (done, total) => onProgress({ step: "steps", label: "Шаги", current: done, total }),
      "mi_fitness",
    );
  }

  private async importSleep(db: Database.Database, userId: string, onProgress: ProgressCallback): Promise<number> {
    const rows = db.prepare(
      "SELECT time, value FROM sleep WHERE deleted=0 ORDER BY time"
    ).all() as { time: number; value: string }[];

    const rawRecords: SleepRec[] = rows.flatMap(r => {
      try {
        const v = JSON.parse(r.value) as SleepJson;
        const bedtime = v.bedtime ?? r.time;
        const wakeUp  = v.wake_up_time;
        if (!bedtime || !wakeUp) return [];

        const stages = (v.items ?? []).flatMap(item => {
          const state = STATE_MAP[item.state];
          return state ? [{ start: item.start_time, end: item.end_time, state }] : [];
        });

        return [{
          bedtime:    new Date(bedtime * 1000),
          wakeUp:     new Date(wakeUp  * 1000),
          durationMin: v.duration,
          deepMin:    v.sleep_deep_duration,
          lightMin:   v.sleep_light_duration,
          remMin:     v.sleep_rem_duration,
          awakeMin:   v.sleep_awake_duration,
          awakeCount: v.awake_count,
          avgHr:      v.avg_hr,
          minHr:      v.min_hr,
          maxHr:      v.max_hr,
          score:      v.score,
          avgBreath:  v.avg_breath ?? v.breath_quality,
          stages:     stages.length ? stages : undefined,
        }];
      } catch { return []; }
    });

    // Separate naps (< NAP_MAX_MIN) from main sleep records
    const napRecs  = rawRecords.filter(r => r.durationMin != null && r.durationMin < NAP_MAX_MIN);
    const mainRecs = rawRecords.filter(r => r.durationMin == null || r.durationMin >= NAP_MAX_MIN);

    // Dedup main sleep by calendar UTC day; merge if two records fall on the same day
    const byKey = new Map<number, SleepRec>();
    for (const rec of mainRecs) {
      const dayKey = Math.floor(rec.bedtime.getTime() / 1000 / 86400);
      const existing = byKey.get(dayKey);
      if (!existing) {
        byKey.set(dayKey, { ...rec });
      } else {
        const merged = { ...existing };
        const fields = ["durationMin","deepMin","lightMin","remMin","awakeMin","awakeCount","avgHr","minHr","maxHr","score","avgBreath"] as const;
        for (const f of fields) {
          if (rec[f] != null && (merged[f] == null || (typeof rec[f] === "number" && typeof merged[f] === "number" && (rec[f] as number) > (merged[f] as number)))) {
            (merged as any)[f] = rec[f];
          }
        }
        if (!merged.stages && rec.stages) merged.stages = rec.stages;
        if ((rec.durationMin ?? 0) > (existing.durationMin ?? 0)) {
          merged.bedtime = rec.bedtime;
          merged.wakeUp  = rec.wakeUp;
        }
        byKey.set(dayKey, merged);
      }
    }

    // Attach each nap to the main sleep of the same or previous UTC day
    const standaloneNaps: SleepRec[] = [];
    for (const nap of napRecs) {
      const napDayKey = Math.floor(nap.bedtime.getTime() / 1000 / 86400);
      const main = byKey.get(napDayKey) ?? byKey.get(napDayKey - 1);
      const napEntry: NapEntry = {
        start: Math.floor(nap.bedtime.getTime() / 1000),
        end:   Math.floor(nap.wakeUp.getTime()   / 1000),
        durationMin: nap.durationMin,
        deepMin:     nap.deepMin,
        lightMin:    nap.lightMin,
        remMin:      nap.remMin,
        awakeMin:    nap.awakeMin,
        stages:      nap.stages,
      };
      if (main) {
        if (!main.naps) main.naps = [];
        main.naps.push(napEntry);
        // Include nap time in the main sleep totals for stats
        if (nap.durationMin) main.durationMin = (main.durationMin ?? 0) + nap.durationMin;
        if (nap.deepMin)     main.deepMin     = (main.deepMin     ?? 0) + nap.deepMin;
        if (nap.lightMin)    main.lightMin    = (main.lightMin    ?? 0) + nap.lightMin;
        if (nap.remMin)      main.remMin      = (main.remMin      ?? 0) + nap.remMin;
        if (nap.awakeMin)    main.awakeMin    = (main.awakeMin    ?? 0) + nap.awakeMin;
      } else {
        // No corresponding night sleep found — keep as standalone record
        standaloneNaps.push(nap);
      }
    }

    const records = [...Array.from(byKey.values()), ...standaloneNaps];

    onProgress({ step: "sleep", label: "Сон", current: 0, total: records.length });
    return this.sleepService.upsertBatch(userId, records,
      (done, total) => onProgress({ step: "sleep", label: "Сон", current: done, total }),
      "mi_fitness",
    );
  }

  private async importActivities(db: Database.Database, userId: string, onProgress: ProgressCallback): Promise<number> {
    const rows = db.prepare(
      "SELECT sid, key, time, value FROM MIWDBSportTable WHERE deleted=0 ORDER BY time"
    ).all() as { sid: string; key: string; time: number; value: string }[];

    const activities = rows.flatMap(r => {
      try {
        const v = JSON.parse(r.value) as SportJson;
        const startTime = v.start_time ?? r.time;
        const endTime   = v.end_time;
        if (!startTime || !endTime) return [];

        const { start_time, end_time, duration, calories, total_cal, avg_hrm, max_hrm, min_hrm,
          train_load, train_effect, train_load_level, recover_time, vo2_max,
          hrm_warm_up_duration, hrm_fat_burning_duration, hrm_aerobic_duration,
          hrm_anaerobic_duration, hrm_extreme_duration, ...rest } = v;

        return [{
          externalSid:   r.sid,
          category:      r.key,
          source:        "mi_fitness",
          startTs:       new Date(startTime * 1000),
          endTs:         new Date(endTime   * 1000),
          durationS:     duration,
          calories:      calories ?? total_cal,
          avgHr:         avg_hrm,
          maxHr:         max_hrm,
          minHr:         min_hrm,
          trainLoad:     train_load,
          trainEffect:   train_effect,
          trainLoadLevel: train_load_level,
          recoverTime:   recover_time,
          vo2Max:        vo2_max,
          extra: {
            hrm_warm_up_duration, hrm_fat_burning_duration, hrm_aerobic_duration,
            hrm_anaerobic_duration, hrm_extreme_duration, ...rest,
          },
        }];
      } catch { return []; }
    });

    onProgress({ step: "activities", label: "Активности", current: 0, total: activities.length });
    return this.activitiesService.upsertBatch(userId, activities,
      (done, total) => onProgress({ step: "activities", label: "Активности", current: done, total }),
    );
  }
}
