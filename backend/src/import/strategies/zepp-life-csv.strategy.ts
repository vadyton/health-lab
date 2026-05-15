import { configure, ZipReader, Uint8ArrayReader, TextWriter, Uint8ArrayWriter } from "@zip.js/zip.js";
import { parseFit } from "../fit-tcx.parser";
import { HeartRateService } from "../../health/heart-rate/heart-rate.service";
import { StepsService } from "../../health/steps/steps.service";
import { SleepService } from "../../health/sleep/sleep.service";
import { ActivitiesService } from "../../activities/activities.service";
import { BodyService } from "../../health/body/body.service";
import { ProgressEvent } from "./sqlite-mi-fitness.strategy";

export const SOURCE = "zepp_life";

// zip.js needs this flag in Node.js (no native CompressionStream)
configure({ useCompressionStream: false });

type ProgressCallback = (event: ProgressEvent) => void;
type CsvFiles = Map<string, string>;      // normalised relative path → content
type FitFiles = Map<string, Buffer>;      // normalised relative path → raw bytes

// Maps Zepp numeric sport type → English category ID (same IDs as Mi Fitness).
// User-confirmed: 1=Running, 6=Walking, 9=Cycling, 16=Free, 17=Tennis, 60=Yoga
const SPORT_TYPES: Record<number, string> = {
  1:   "outdoor_run",
  2:   "indoor_run",
  3:   "walking",
  4:   "cycling",
  5:   "free_training",
  6:   "walking",
  7:   "swimming",
  8:   "indoor_riding",
  9:   "outdoor_riding",
  15:  "hiking",
  16:  "free_training",
  17:  "tennis",
  21:  "rope_skipping",
  23:  "rowing",
  24:  "free_training",
  41:  "curling",
  44:  "ice_skating",
  48:  "bmx",
  49:  "hiit",
  50:  "core_training",
  51:  "aerobics",
  52:  "strength_training",
  53:  "stretching",
  54:  "stepper",
  55:  "flexibility",
  59:  "gymnastics",
  60:  "yoga",
  61:  "pilates",
  64:  "fishing",
  65:  "sailing",
  66:  "rowing",
  67:  "skateboarding",
  69:  "roller_skating",
  70:  "rock_climbing",
  71:  "ballet",
  72:  "dancing",
  73:  "dancing",
  74:  "dancing",
  75:  "dancing",
  76:  "dancing",
  77:  "dancing",
  78:  "cricket",
  79:  "baseball",
  80:  "bowling",
  81:  "squash",
  85:  "basketball",
  86:  "softball",
  88:  "volleyball",
  89:  "pingpong",
  91:  "handball",
  92:  "badminton",
  93:  "archery",
  97:  "boxing",
  100: "tai_chi",
  101: "muay_thai",
  102: "taekwondo",
  103: "martial_arts",
  104: "kickboxing",
  109: "aerobics",
  129: "parkour",
  130: "cross_training",
  131: "race_walking",
  140: "kayaking",
  143: "spinning",
  165: "dancing",
  191: "football",
};

export function zeppSportName(type: string): string {
  const n = parseInt(type, 10);
  return SPORT_TYPES[n] ?? `zepp_${n}`;
}

// ── ZIP extraction via @zip.js/zip.js (supports ZipCrypto + AES-256) ─────────

interface ExtractedZip {
  csvFiles: CsvFiles;
  fitFiles: FitFiles;
}

async function extractZipToMap(buffer: Buffer, password?: string): Promise<ExtractedZip> {
  const readerOptions = password ? { password } : {};
  const zipReader = new ZipReader(new Uint8ArrayReader(new Uint8Array(buffer)), readerOptions);

  let entries: Awaited<ReturnType<typeof zipReader.getEntries>>;
  try {
    entries = await zipReader.getEntries();
  } catch (e: any) {
    throw new Error(`Не удалось открыть архив: ${e.message ?? e}`);
  }

  const dataEntries = entries.filter(e => !e.directory &&
    (e.filename.endsWith(".csv") || e.filename.toLowerCase().endsWith(".fit"))
  );

  const csvEntries = dataEntries.filter(e => e.filename.endsWith(".csv"));

  if (csvEntries.length === 0) {
    const folders = [...new Set(entries.map(e => e.filename.split("/")[0]))].slice(0, 8);
    throw new Error(
      `CSV-файлы Zepp не найдены в архиве. Найдены элементы: ${folders.join(", ") || "(нет)"}. ` +
      `Убедитесь, что вы загружаете архив экспорта Zepp Life.`
    );
  }

  const EXPECTED = ["ACTIVITY", "HEARTRATE_AUTO", "HEARTRATE", "SLEEP", "SPORT", "BODY"];
  const foundFolders = EXPECTED.filter(f =>
    csvEntries.some(e => new RegExp(`(?:^|/)${f}/`).test(e.filename.replace(/\\/g, "/")))
  );
  if (foundFolders.length === 0) {
    const topDirs = [...new Set(csvEntries.map(e => e.filename.split("/")[0]))].slice(0, 8);
    throw new Error(
      `Файлы Zepp не найдены в архиве. Найдены папки: ${topDirs.join(", ") || "(нет)"}. ` +
      `Убедитесь, что вы загружаете архив экспорта Zepp Life.`
    );
  }

  const csvFiles: CsvFiles = new Map();
  const fitFiles: FitFiles = new Map();

  for (const entry of dataEntries) {
    const getData = (entry as any).getData;
    if (!getData) continue;
    try {
      const isFit = entry.filename.toLowerCase().endsWith(".fit");
      if (isFit) {
        const arr: Uint8Array = await getData(new Uint8ArrayWriter());
        fitFiles.set(entry.filename.replace(/\\/g, "/"), Buffer.from(arr));
      } else {
        const text: string = await getData(new TextWriter());
        csvFiles.set(entry.filename.replace(/\\/g, "/"), text);
      }
    } catch (e: any) {
      const msg: string = (e.message ?? String(e)).toLowerCase();
      if (msg.includes("password") || msg.includes("decrypt") || msg.includes("invalid")) {
        if (!password) throw new Error("Архив защищён паролем. Введите пароль из письма Zepp.");
        throw new Error("Неверный пароль. Проверьте пароль из письма Zepp.");
      }
      // Skip corrupted/unknown entries silently
    }
  }

  await zipReader.close();
  return { csvFiles, fitFiles };
}

/** Find a CSV by Zepp folder name regardless of nesting depth. */
function findCsv(files: CsvFiles, folderPrefix: string): string | null {
  const re = new RegExp(`(?:^|/)${folderPrefix}/[^/]+\\.csv$`);
  for (const [relPath, content] of files) {
    if (re.test(relPath)) return content;
  }
  return null;
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCsv(content: string): Record<string, string>[] {
  // Strip UTF-8 BOM (﻿) using explicit unicode escape — more reliable than literal character
  const lines = content.replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  // Also strip BOM from the header line itself in case it wasn't at position 0
  const headers = lines[0].replace(/^﻿/, "").split(",").map(h => h.trim());
  return lines.slice(1).flatMap(line => {
    const vals = line.split(",");
    const row: Record<string, string> = {};
    // Lenient: accept rows with fewer OR more values than headers
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return [row];
  });
}

function parseZeppDate(date: string, time?: string): Date | null {
  try {
    if (!time) {
      const d = new Date(`${date}T00:00:00Z`);
      return isNaN(d.getTime()) ? null : d;
    }
    if (time.includes("-") || time.length > 5) {
      const d = new Date(time.replace(/\+0000$/, "Z").replace(" ", "T"));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(`${date}T${time}:00Z`);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

// ── Strategy ─────────────────────────────────────────────────────────────────

export class ZeppLifeCsvStrategy {
  constructor(
    private readonly heartRateService: HeartRateService,
    private readonly stepsService: StepsService,
    private readonly sleepService: SleepService,
    private readonly activitiesService: ActivitiesService,
    private readonly bodyService: BodyService,
  ) {}

  async import(zipBuffer: Buffer, userId: string, onProgress: ProgressCallback, password?: string): Promise<Record<string, number>> {
    const { csvFiles, fitFiles } = await extractZipToMap(zipBuffer, password || undefined);

    // Get max timestamps already imported from Zepp to skip duplicates
    const maxTs = await this.activitiesService.getImportMaxTimestampsBySource(userId, SOURCE);

    const stats: Record<string, number> = {};
    stats.heartRate  = await this.importHeartRate(csvFiles, userId, onProgress, maxTs.heartRate);
    stats.steps      = await this.importSteps(csvFiles, userId, onProgress, maxTs.steps);
    stats.sleep      = await this.importSleep(csvFiles, userId, onProgress, maxTs.sleep);
    stats.activities = await this.importActivities(csvFiles, userId, onProgress, maxTs.activities);
    stats.body       = await this.importBody(csvFiles, userId, onProgress, maxTs.body);
    stats.gps        = await this.importGpsFromFitFiles(fitFiles, userId, onProgress);
    stats.activityHr = await this.activitiesService.linkHeartRateFromGlobal(userId);

    return stats;
  }

  private async importGpsFromFitFiles(fitFiles: FitFiles, userId: string, onProgress: ProgressCallback): Promise<number> {
    if (fitFiles.size === 0) return 0;

    onProgress({ step: "gps", label: "Маршруты", current: 0, total: fitFiles.size });
    let saved = 0;
    let done  = 0;

    for (const [, buf] of fitFiles) {
      done++;
      try {
        const parsed = parseFit(buf);
        if (!parsed || parsed.gpsPoints.length === 0) continue;

        const ok = await this.activitiesService.saveGpsForActivityByStartTs(
          userId,
          parsed.startTs,
          parsed.gpsPoints,
          {
            distanceM:    parsed.distanceM    ?? undefined,
            avgSpeed:     parsed.avgSpeed     ?? undefined,
            maxSpeed:     parsed.maxSpeed     ?? undefined,
            totalAscent:  parsed.totalAscent  ?? undefined,
            totalDescent: parsed.totalDescent ?? undefined,
          },
        );
        if (ok) saved++;
      } catch { /* skip unreadable FIT files */ }
      onProgress({ step: "gps", label: "Маршруты", current: done, total: fitFiles.size });
    }

    return saved;
  }

  private async importHeartRate(files: CsvFiles, userId: string, onProgress: ProgressCallback, afterTs?: Date): Promise<number> {
    const samples: { ts: Date; bpm: number }[] = [];

    const autoContent = findCsv(files, "HEARTRATE_AUTO");
    if (autoContent) {
      for (const row of parseCsv(autoContent)) {
        const bpm = parseInt(row["heartRate"], 10);
        if (!bpm || bpm <= 0) continue;
        const ts = parseZeppDate(row["date"], row["time"]);
        if (ts && (!afterTs || ts > afterTs)) samples.push({ ts, bpm });
      }
    }

    const manualContent = findCsv(files, "HEARTRATE");
    if (manualContent) {
      for (const row of parseCsv(manualContent)) {
        const bpm = parseInt(row["heartRate"], 10);
        if (!bpm || bpm <= 0) continue;
        const ts = parseZeppDate("", row["time"]);
        if (ts && (!afterTs || ts > afterTs)) samples.push({ ts, bpm });
      }
    }

    samples.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    onProgress({ step: "heartRate", label: "Пульс", current: 0, total: samples.length });
    return this.heartRateService.upsertBatch(userId, samples,
      (done, total) => onProgress({ step: "heartRate", label: "Пульс", current: done, total }),
      SOURCE,
    );
  }

  private async importSteps(files: CsvFiles, userId: string, onProgress: ProgressCallback, afterTs?: Date): Promise<number> {
    const content = findCsv(files, "ACTIVITY");
    if (!content) {
      onProgress({ step: "steps", label: "Шаги", current: 0, total: 0 });
      return 0;
    }

    const samples: { ts: Date; steps: number; distanceM?: number; calories?: number }[] = [];
    for (const row of parseCsv(content)) {
      const steps = parseInt(row["steps"], 10);
      if (!steps || steps <= 0) continue;
      const ts = parseZeppDate(row["date"]);
      if (!ts || (afterTs && ts <= afterTs)) continue;
      samples.push({
        ts,
        steps,
        distanceM: parseInt(row["distance"], 10) || undefined,
        calories:  parseInt(row["calories"], 10) || undefined,
      });
    }

    onProgress({ step: "steps", label: "Шаги", current: 0, total: samples.length });
    return this.stepsService.upsertBatch(userId, samples,
      (done, total) => onProgress({ step: "steps", label: "Шаги", current: done, total }),
      SOURCE,
    );
  }

  private async importSleep(files: CsvFiles, userId: string, onProgress: ProgressCallback, afterTs?: Date): Promise<number> {
    const stageMap = new Map<string, { start: number; end: number; state: string }[]>();
    const minuteContent = findCsv(files, "SLEEP_MINUTE");
    if (minuteContent) {
      const STAGE_MAP: Record<string, string> = { DEEP: "deep", LIGHT: "light", REM: "rem", WAKE: "awake" };
      const byDate = new Map<string, { ts: Date; state: string }[]>();
      for (const row of parseCsv(minuteContent)) {
        const state = STAGE_MAP[row["stage"]];
        if (!state) continue;
        const ts = parseZeppDate(row["date"], row["time"]);
        if (!ts) continue;
        if (!byDate.has(row["date"])) byDate.set(row["date"], []);
        byDate.get(row["date"])!.push({ ts, state });
      }
      for (const [date, minutes] of byDate) {
        minutes.sort((a, b) => a.ts.getTime() - b.ts.getTime());
        const intervals: { start: number; end: number; state: string }[] = [];
        let cur: { start: number; end: number; state: string } | null = null;
        for (const m of minutes) {
          const t = Math.floor(m.ts.getTime() / 1000);
          if (!cur || cur.state !== m.state) {
            if (cur) intervals.push(cur);
            cur = { start: t, end: t + 60, state: m.state };
          } else {
            cur.end = t + 60;
          }
        }
        if (cur) intervals.push(cur);
        stageMap.set(date, intervals);
      }
    }

    const sleepContent = findCsv(files, "SLEEP");
    if (!sleepContent) {
      onProgress({ step: "sleep", label: "Сон", current: 0, total: 0 });
      return 0;
    }

    const records: Parameters<SleepService["upsertBatch"]>[1] = [];
    for (const row of parseCsv(sleepContent)) {
      const bedtime = parseZeppDate("", row["start"]);
      const wakeUp  = parseZeppDate("", row["stop"]);
      if (!bedtime || !wakeUp || bedtime.getTime() === wakeUp.getTime()) continue;
      if (afterTs && bedtime <= afterTs) continue;

      const deepMin    = parseInt(row["deepSleepTime"], 10)    || undefined;
      const lightMin   = parseInt(row["shallowSleepTime"], 10) || undefined;
      const awakeMin   = parseInt(row["wakeTime"], 10)         || undefined;
      const remMin     = parseInt(row["REMTime"], 10)          || undefined;
      const durationMin = (deepMin != null || lightMin != null || remMin != null)
        ? (deepMin ?? 0) + (lightMin ?? 0) + (remMin ?? 0) + (awakeMin ?? 0)
        : undefined;

      let naps: unknown = undefined;
      const napsRaw = row["naps"]?.trim().replace(/^"|"$/g, "").replace(/""/g, '"');
      if (napsRaw) {
        try { naps = JSON.parse(napsRaw); } catch { /* ignore */ }
      }

      records.push({
        bedtime, wakeUp, durationMin, deepMin, lightMin, remMin, awakeMin, naps,
        stages: stageMap.get(row["date"]),
      });
    }

    onProgress({ step: "sleep", label: "Сон", current: 0, total: records.length });
    return this.sleepService.upsertBatch(userId, records,
      (done, total) => onProgress({ step: "sleep", label: "Сон", current: done, total }),
      SOURCE,
    );
  }

  private async importActivities(files: CsvFiles, userId: string, onProgress: ProgressCallback, afterTs?: Date): Promise<number> {
    const content = findCsv(files, "SPORT");
    if (!content) {
      onProgress({ step: "activities", label: "Активности", current: 0, total: 0 });
      return 0;
    }

    const activities: Parameters<ActivitiesService["upsertBatch"]>[1] = [];
    for (const row of parseCsv(content)) {
      const startTs = parseZeppDate("", row["startTime"]);
      if (!startTs) continue;
      if (afterTs && startTs <= afterTs) continue;
      const durationS = parseInt(row["sportTime(s)"], 10) || undefined;
      if (!durationS) continue;
      const endTs     = new Date(startTs.getTime() + durationS * 1000);
      const distanceM = parseFloat(row["distance(m)"]);
      const calories  = parseFloat(row["calories(kcal)"]);
      const avgPace   = parseFloat(row["avgPace(/meter)"]);
      const maxPace   = parseFloat(row["maxPace(/meter)"]);
      const minPace   = parseFloat(row["minPace(/meter)"]);

      activities.push({
        category: zeppSportName(row["type"]),
        source:   SOURCE,
        startTs, endTs, durationS,
        distanceM: distanceM > 0 ? distanceM : undefined,
        calories:  calories  > 0 ? calories  : undefined,
        extra: {
          zeppType: parseInt(row["type"], 10),
          avgPace:  avgPace > 0 && avgPace < 1e6 ? avgPace : undefined,
          maxPace:  maxPace > 0 && maxPace < 1e6 ? maxPace : undefined,
          minPace:  minPace > 0 && minPace < 1e6 ? minPace : undefined,
        },
      });
    }

    onProgress({ step: "activities", label: "Активности", current: 0, total: activities.length });
    return this.activitiesService.upsertBatch(userId, activities,
      (done, total) => onProgress({ step: "activities", label: "Активности", current: done, total }),
    );
  }

  private async importBody(files: CsvFiles, userId: string, onProgress: ProgressCallback, afterTs?: Date): Promise<number> {
    const content = findCsv(files, "BODY");
    if (!content) {
      onProgress({ step: "body", label: "Состав тела", current: 0, total: 0 });
      return 0;
    }

    const records: Parameters<BodyService["upsertBatch"]>[1] = [];
    for (const row of parseCsv(content)) {
      const ts       = parseZeppDate("", row["time"]);
      const weightKg = parseFloat(row["weight"]);
      if (!ts || !weightKg || weightKg <= 0) continue;
      if (afterTs && ts <= afterTs) continue;

      records.push({
        ts, weightKg,
        heightCm:      parseFloat(row["height"])       || undefined,
        bmi:           parseFloat(row["bmi"])           || undefined,
        fatRate:       parseFloat(row["fatRate"])       || undefined,
        bodyWaterRate: parseFloat(row["bodyWaterRate"]) || undefined,
        boneMassKg:    parseFloat(row["boneMass"])      || undefined,
        metabolism:    parseFloat(row["metabolism"])    || undefined,
        muscleRate:    parseFloat(row["muscleRate"])    || undefined,
        visceralFat:   parseFloat(row["visceralFat"])   || undefined,
      });
    }

    onProgress({ step: "body", label: "Состав тела", current: 0, total: records.length });
    return this.bodyService.upsertBatch(userId, records,
      (done, total) => onProgress({ step: "body", label: "Состав тела", current: done, total }),
      SOURCE,
    );
  }
}
