import { XMLParser } from "fast-xml-parser";
import { Decoder, Stream, Utils } from "@garmin/fitsdk";

export interface ParsedActivity {
  externalSid: string;
  category: string;
  startTs: Date;
  endTs: Date;
  durationS: number;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  distanceM?: number;
  avgSpeed?: number;
  maxSpeed?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgPower?: number;
  maxPower?: number;
  totalAscent?: number;
  totalDescent?: number;
  hrSamples: { ts: Date; bpm: number }[];
  gpsPoints: { ts: number; lat: number; lng: number; altM?: number }[];
}

const SEMI_TO_DEG = 180 / 2147483648;
const MAX_GPS = 5000;

// @garmin/fitsdk may return position either as raw semicircles (sint32) or already
// converted to degrees depending on SDK version. Any valid lat/lng is ≤ ±180°,
// so |value| > 180 unambiguously means semicircles.
function toCoord(val: unknown): number | null {
  const n = Number(val);
  if (!isFinite(n) || n === 0) return null;
  return Math.abs(n) > 180 ? n * SEMI_TO_DEG : n;
}

function sportToCategory(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes("run"))                             return "outdoor_run";
  if (s.includes("cycl") || s.includes("bik"))      return "cycling";
  if (s.includes("swim"))                            return "swim";
  if (s.includes("walk"))                            return "outdoor_walking";
  if (s.includes("yoga"))                            return "yoga";
  if (s.includes("tennis"))                          return "tennis";
  if (s.includes("strength") || s.includes("train")) return "strength_training";
  return "other";
}

function dedupHr(samples: { ts: Date; bpm: number }[]) {
  const seen = new Set<number>();
  return samples
    .filter(s => { const t = s.ts.getTime(); if (seen.has(t)) return false; seen.add(t); return true; })
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const result: T[] = [arr[0]];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) result.push(arr[Math.round(i * step)]);
  result.push(arr[arr.length - 1]);
  return result;
}

export function parseTcx(content: string): ParsedActivity | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: name => ["Trackpoint", "Lap", "Activity"].includes(name),
    });
    const doc = parser.parse(content);
    const activities: unknown[] = doc?.TrainingCenterDatabase?.Activities?.Activity ?? [];
    if (!activities.length) return null;

    const act = activities[0] as Record<string, unknown>;
    const category = sportToCategory(String(act["@_Sport"] ?? "other"));

    const idStr = String(act.Id ?? "");
    const startSec = idStr ? Math.round(new Date(idStr).getTime() / 1000) : 0;
    if (!startSec || isNaN(startSec)) return null;

    let totalTime = 0, totalCal = 0, maxHr = 0, totalDist = 0;
    let avgSpeedSum = 0, maxSpeedVal = 0, avgCadenceSum = 0, maxCadenceVal = 0;
    let avgPowerSum = 0, maxPowerVal = 0, lapCount = 0;

    const laps = (act.Lap as Record<string, unknown>[] | undefined) ?? [];
    for (const lap of laps) {
      totalTime += Number(lap.TotalTimeSeconds ?? 0);
      totalCal  += Number(lap.Calories ?? 0);
      totalDist += Number(lap.DistanceMeters ?? 0);
      maxHr = Math.max(maxHr, Number((lap.MaximumHeartRateBpm as Record<string,unknown>)?.Value ?? 0));

      const ext = ((lap.Extensions as Record<string,unknown>)?.LX as Record<string,unknown>) ?? {};
      if (ext.AvgSpeed)       { avgSpeedSum   += Number(ext.AvgSpeed); }
      if (ext.MaxSpeed)       { maxSpeedVal    = Math.max(maxSpeedVal, Number(ext.MaxSpeed)); }
      if (ext.AvgRunCadence)  { avgCadenceSum += Number(ext.AvgRunCadence); }
      if (ext.AvgBikeCadence) { avgCadenceSum += Number(ext.AvgBikeCadence); }
      if (ext.MaxRunCadence)  { maxCadenceVal  = Math.max(maxCadenceVal, Number(ext.MaxRunCadence)); }
      if (ext.MaxBikeCadence) { maxCadenceVal  = Math.max(maxCadenceVal, Number(ext.MaxBikeCadence)); }
      if (ext.AvgWatts)       { avgPowerSum   += Number(ext.AvgWatts); }
      if (ext.MaxWatts)       { maxPowerVal    = Math.max(maxPowerVal, Number(ext.MaxWatts)); }
      lapCount++;
    }

    const hrSamples: { ts: Date; bpm: number }[] = [];
    const gpsPoints: { ts: number; lat: number; lng: number; altM?: number }[] = [];

    function walkTp(obj: unknown): void {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(walkTp); return; }
      const node = obj as Record<string, unknown>;

      if (node.Time) {
        const ts = new Date(String(node.Time));
        const tsMs = ts.getTime();
        if (tsMs > 0) {
          if (node.HeartRateBpm) {
            const bpm = Number((node.HeartRateBpm as Record<string,unknown>)?.Value ?? 0);
            if (bpm > 0) hrSamples.push({ ts, bpm: Math.round(bpm) });
          }
          if (node.Position) {
            const pos = node.Position as Record<string, unknown>;
            const lat = Number(pos.LatitudeDegrees);
            const lng = Number(pos.LongitudeDegrees);
            if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
              const altM = node.AltitudeMeters != null ? Number(node.AltitudeMeters) : undefined;
              gpsPoints.push({ ts: Math.round(tsMs / 1000), lat, lng, altM });
            }
          }
        }
      }
      Object.values(node).forEach(walkTp);
    }
    walkTp(act);

    const deduped = dedupHr(hrSamples);
    const avgHrVal = deduped.length
      ? Math.round(deduped.reduce((s, x) => s + x.bpm, 0) / deduped.length) : 0;

    return {
      externalSid: `tcx_${startSec}`,
      category,
      startTs:   new Date(startSec * 1000),
      endTs:     new Date((startSec + Math.round(totalTime)) * 1000),
      durationS: Math.round(totalTime),
      calories:  totalCal  || undefined,
      avgHr:     avgHrVal  || undefined,
      maxHr:     maxHr     || undefined,
      distanceM: totalDist || undefined,
      avgSpeed:  lapCount && avgSpeedSum  ? avgSpeedSum / lapCount  : undefined,
      maxSpeed:  maxSpeedVal  || undefined,
      avgCadence: lapCount && avgCadenceSum ? avgCadenceSum / lapCount : undefined,
      maxCadence: maxCadenceVal || undefined,
      avgPower:  lapCount && avgPowerSum  ? avgPowerSum / lapCount  : undefined,
      maxPower:  maxPowerVal  || undefined,
      hrSamples: deduped,
      gpsPoints: downsample(gpsPoints, MAX_GPS),
    };
  } catch (e) {
    console.error("[parseTcx]", (e as Error).message);
    return null;
  }
}

export function parseFit(buffer: Buffer): ParsedActivity | null {
  try {
    const stream  = Stream.fromBuffer(buffer);
    const decoder = new Decoder(stream);
    const { messages } = decoder.read();
    const msgs = messages as Record<string, unknown[]>;

    const session = ((msgs.sessionMesgs ?? [])[0] ?? {}) as Record<string, unknown>;

    const startDate =
      session.startTime instanceof Date ? session.startTime :
      session.startTime ? Utils.convertDateTimeToDate(Number(session.startTime)) : null;
    if (!startDate) return null;

    const startSec = Math.round(startDate.getTime() / 1000);
    const totalElapsed = Number(session.totalElapsedTime ?? session.totalTimerTime ?? 0);

    const hrSamples: { ts: Date; bpm: number }[] = [];
    const gpsPoints: { ts: number; lat: number; lng: number; altM?: number }[] = [];

    for (const rec of (msgs.recordMesgs ?? [])) {
      const r = rec as Record<string, unknown>;
      if (!r.timestamp) continue;

      const ts = r.timestamp instanceof Date
        ? r.timestamp
        : Utils.convertDateTimeToDate(Number(r.timestamp));

      if (r.heartRate) {
        const bpm = Number(r.heartRate);
        if (bpm > 0) hrSamples.push({ ts, bpm: Math.round(bpm) });
      }

      if (r.positionLat != null && r.positionLong != null) {
        const lat = toCoord(r.positionLat);
        const lng = toCoord(r.positionLong);
        if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          const altM = r.altitude != null ? Number(r.altitude) : undefined;
          gpsPoints.push({ ts: Math.round(ts.getTime() / 1000), lat, lng, altM });
        }
      }
    }

    return {
      externalSid: `fit_${startSec}`,
      category:    sportToCategory(String(session.sport ?? "other")),
      startTs:     startDate,
      endTs:       new Date((startSec + Math.round(totalElapsed)) * 1000),
      durationS:   Math.round(totalElapsed),
      calories:    Number(session.totalCalories ?? 0) || undefined,
      avgHr:       Number(session.avgHeartRate  ?? 0) || undefined,
      maxHr:       Number(session.maxHeartRate  ?? 0) || undefined,
      distanceM:   Number(session.totalDistance ?? 0) || undefined,
      avgSpeed:    Number(session.avgSpeed       ?? 0) || undefined,
      maxSpeed:    Number(session.maxSpeed       ?? 0) || undefined,
      avgCadence:  Number(session.avgCadence     ?? 0) || undefined,
      maxCadence:  Number(session.maxCadence     ?? 0) || undefined,
      avgPower:    Number(session.avgPower       ?? 0) || undefined,
      maxPower:    Number(session.maxPower       ?? 0) || undefined,
      totalAscent: Number(session.totalAscent   ?? 0) || undefined,
      totalDescent: Number(session.totalDescent ?? 0) || undefined,
      hrSamples:   dedupHr(hrSamples),
      gpsPoints:   downsample(gpsPoints, MAX_GPS),
    };
  } catch (e) {
    console.error("[parseFit]", (e as Error).message);
    return null;
  }
}
