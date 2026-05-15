import { Injectable } from "@nestjs/common";
import { Encoder, Profile, Utils } from "@garmin/fitsdk";

export interface HrSample { time: number; bpm: number }

export interface GpsExportPoint {
  ts: number;
  lat: number;
  lng: number;
  altM?: number | null;
}

export interface ActivityExportData {
  id: string;
  externalSid?: string | null;
  category: string;
  start: number;
  end: number;
  durationS: number;
  calories?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  distanceM?: number | null;
  avgSpeed?: number | null;    // m/s
  maxSpeed?: number | null;    // m/s
  avgCadence?: number | null;  // steps/min or rpm
  maxCadence?: number | null;
  avgPower?: number | null;    // watts
  maxPower?: number | null;    // watts
  totalAscent?: number | null; // meters
  totalDescent?: number | null; // meters
  extra?: Record<string, unknown> | null;
  hrSamples: HrSample[];
  gpsPoints: GpsExportPoint[];
}

// ── Sport mapping ──────────────────────────────────────────────────────────

function tcxSport(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("run"))                        return "Running";
  if (c.includes("walk"))                       return "Walking";
  if (c.includes("cycl") || c.includes("bike")) return "Biking";
  return "Other";
}

function fitSport(category: string): { sport: string; subSport: string } {
  const c = category.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, { sport: string; subSport: string }> = {
    outdoor_run:         { sport: "running",  subSport: "generic" },
    indoor_run:          { sport: "running",  subSport: "treadmill" },
    outdoor_walking:     { sport: "walking",  subSport: "generic" },
    walking:             { sport: "walking",  subSport: "generic" },
    cycling:             { sport: "cycling",  subSport: "generic" },
    swim:                { sport: "swimming", subSport: "generic" },
    swimming:            { sport: "swimming", subSport: "generic" },
    tennis:              { sport: "tennis",   subSport: "generic" },
    table_tennis:        { sport: "tennis",   subSport: "generic" },
    pingpong:            { sport: "tennis",   subSport: "generic" },
    badminton:           { sport: "training", subSport: "generic" },
    yoga:                { sport: "training", subSport: "yoga" },
    free_training:       { sport: "training", subSport: "generic" },
    outdoor_riding:      { sport: "cycling",  subSport: "generic" },
    indoor_riding:       { sport: "cycling",  subSport: "indoorCycling" },
    strength_training:   { sport: "training", subSport: "strengthTraining" },
    lower_limb_training: { sport: "training", subSport: "strengthTraining" },
    upper_limb_training: { sport: "training", subSport: "strengthTraining" },
    hiit:                { sport: "training", subSport: "hiit" },
    elliptical:          { sport: "training", subSport: "elliptical" },
    rowing:              { sport: "training", subSport: "rowingMachine" },
  };
  return map[c] ?? { sport: "training", subSport: "generic" };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function isoUtc(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

function isCycling(category: string): boolean {
  const c = category.toLowerCase();
  return c.includes("cycl") || c.includes("bike");
}

// Binary-search the HR sample nearest to `ts` (max 120s gap).
function nearestHr(sorted: HrSample[], ts: number): number | undefined {
  if (!sorted.length) return undefined;
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].time < ts) lo = mid + 1; else hi = mid;
  }
  const candidates: HrSample[] = [sorted[lo]];
  if (lo > 0) candidates.push(sorted[lo - 1]);
  const best = candidates.reduce((a, b) =>
    Math.abs(a.time - ts) <= Math.abs(b.time - ts) ? a : b);
  return Math.abs(best.time - ts) <= 120 ? best.bpm : undefined;
}

const DEG_TO_SEMI = 2147483648 / 180;

// ── TCX ────────────────────────────────────────────────────────────────────

@Injectable()
export class ExportService {
  generateTcx(a: ActivityExportData): string {
    const NS     = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";
    const NS_AX  = "http://www.garmin.com/xmlschemas/ActivityExtension/v2";
    const NS_XSI = "http://www.w3.org/2001/XMLSchema-instance";
    const sport  = tcxSport(a.category);
    const notes  = escapeXml(`Mi Fitness: ${a.category}`);

    const avgHr = a.avgHr ?? (a.hrSamples.length
      ? Math.round(a.hrSamples.reduce((s, x) => s + x.bpm, 0) / a.hrSamples.length) : undefined);
    const maxHr = a.maxHr ?? (a.hrSamples.length
      ? (() => { let m = 0; for (const x of a.hrSamples) if (x.bpm > m) m = x.bpm; return m; })()
      : undefined);

    let trackXml = "";
    if (a.gpsPoints.length > 0) {
      // GPS-primary: one Trackpoint per GPS point, HR interpolated from samples
      for (const g of a.gpsPoints) {
        const hr = nearestHr(a.hrSamples, g.ts);
        const posXml = `
            <Position>
              <LatitudeDegrees>${g.lat}</LatitudeDegrees>
              <LongitudeDegrees>${g.lng}</LongitudeDegrees>
            </Position>`;
        const altXml = g.altM != null ? `\n            <AltitudeMeters>${g.altM.toFixed(1)}</AltitudeMeters>` : "";
        const hrXml  = hr != null ? `
            <HeartRateBpm xsi:type="HeartRateInBeatsPerMinute_t">
              <Value>${hr}</Value>
            </HeartRateBpm>` : "";
        trackXml += `
          <Trackpoint>
            <Time>${isoUtc(g.ts)}</Time>${posXml}${altXml}${hrXml}
          </Trackpoint>`;
      }
    } else if (a.hrSamples.length) {
      // HR-only: existing behaviour
      for (const s of a.hrSamples) {
        trackXml += `
          <Trackpoint>
            <Time>${isoUtc(s.time)}</Time>
            <HeartRateBpm xsi:type="HeartRateInBeatsPerMinute_t">
              <Value>${s.bpm}</Value>
            </HeartRateBpm>
          </Trackpoint>`;
      }
    } else {
      trackXml = `
          <Trackpoint>
            <Time>${isoUtc(a.start)}</Time>
            <HeartRateBpm xsi:type="HeartRateInBeatsPerMinute_t">
              <Value>${avgHr ?? 0}</Value>
            </HeartRateBpm>
          </Trackpoint>`;
    }

    const lapAvgHr = avgHr != null ? `
            <AverageHeartRateBpm xsi:type="HeartRateInBeatsPerMinute_t">
              <Value>${avgHr}</Value>
            </AverageHeartRateBpm>` : "";
    const lapMaxHr = maxHr != null ? `
            <MaximumHeartRateBpm xsi:type="HeartRateInBeatsPerMinute_t">
              <Value>${maxHr}</Value>
            </MaximumHeartRateBpm>` : "";
    const lapCal  = a.calories != null ? `
            <Calories>${Math.round(a.calories)}</Calories>` : "";
    const lapDist = a.distanceM != null
      ? `\n            <DistanceMeters>${a.distanceM.toFixed(1)}</DistanceMeters>`
      : `\n            <DistanceMeters>0</DistanceMeters>`;

    // ActivityExtension/v2 LX block
    const lxParts: string[] = [];
    if (a.avgSpeed  != null) lxParts.push(`<AvgSpeed>${a.avgSpeed.toFixed(4)}</AvgSpeed>`);
    if (a.maxSpeed  != null) lxParts.push(`<MaxSpeed>${a.maxSpeed.toFixed(4)}</MaxSpeed>`);
    if (a.avgCadence != null) {
      const tag = isCycling(a.category) ? "AvgBikeCadence" : "AvgRunCadence";
      lxParts.push(`<${tag}>${Math.round(a.avgCadence)}</${tag}>`);
    }
    if (a.maxCadence != null) {
      const tag = isCycling(a.category) ? "MaxBikeCadence" : "MaxRunCadence";
      lxParts.push(`<${tag}>${Math.round(a.maxCadence)}</${tag}>`);
    }
    if (a.avgPower != null) lxParts.push(`<AvgWatts>${Math.round(a.avgPower)}</AvgWatts>`);
    if (a.maxPower != null) lxParts.push(`<MaxWatts>${Math.round(a.maxPower)}</MaxWatts>`);

    const lapExt = lxParts.length ? `
            <Extensions>
              <LX xmlns="${NS_AX}">
                ${lxParts.join("\n                ")}
              </LX>
            </Extensions>` : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="${NS}" xmlns:xsi="${NS_XSI}"
  xsi:schemaLocation="${NS} http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sport}">
      <Id>${isoUtc(a.start)}</Id>
      <Notes>${notes}</Notes>
      <Lap StartTime="${isoUtc(a.start)}">
        <TotalTimeSeconds>${a.durationS}</TotalTimeSeconds>${lapDist}${lapCal}${lapAvgHr}${lapMaxHr}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${trackXml}
        </Track>${lapExt}
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>Mi Fitness export</Name>
        <UnitId>0</UnitId><ProductId>0</ProductId>
        <Version><VersionMajor>1</VersionMajor><VersionMinor>0</VersionMinor></Version>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
  }

  // ── FIT ─────────────────────────────────────────────────────────────────

  generateFit(a: ActivityExportData): Buffer {
    const { sport, subSport } = fitSport(a.category);
    const start    = new Date(a.start * 1000);
    const end      = new Date(a.end   * 1000);
    const startFit = Utils.convertDateToDateTime(start);
    const endFit   = Utils.convertDateToDateTime(end);
    const duration = Math.max(0, a.end - a.start);

    const avgHr = a.avgHr ?? (a.hrSamples.length
      ? Math.round(a.hrSamples.reduce((s, x) => s + x.bpm, 0) / a.hrSamples.length) : undefined);
    const maxHr = a.maxHr ?? (a.hrSamples.length
      ? (() => { let m = 0; for (const x of a.hrSamples) if (x.bpm > m) m = x.bpm; return m; })()
      : undefined);

    const hrList = a.hrSamples.length > 0 ? a.hrSamples : (() => {
      if (!avgHr) return [];
      const out: HrSample[] = [];
      for (let t = a.start; t <= a.end; t += 60) out.push({ time: t, bpm: avgHr });
      return out;
    })();

    const sid = a.externalSid ?? a.id;
    const mesgs: Record<string, unknown>[] = [
      {
        mesgNum: Profile.MesgNum.FILE_ID,
        type: "activity", manufacturer: "development", product: 0,
        timeCreated: startFit,
        serialNumber: Number(sid.replace(/\D/g, "").slice(-8)) || 1,
      },
      {
        mesgNum: Profile.MesgNum.DEVICE_INFO,
        deviceIndex: "creator", manufacturer: "development",
        product: 0, productName: "Mi Fitness", timestamp: startFit,
      },
      {
        mesgNum: Profile.MesgNum.EVENT,
        timestamp: startFit, event: "timer", eventType: "start", timerTrigger: "manual",
      },
    ];

    let lastTs = startFit;

    if (a.gpsPoints.length > 0) {
      // GPS-primary: one RECORD per GPS point, HR interpolated
      for (const g of a.gpsPoints) {
        const ts  = Utils.convertDateToDateTime(new Date(g.ts * 1000));
        const rec: Record<string, unknown> = {
          mesgNum:     Profile.MesgNum.RECORD,
          timestamp:   ts,
          positionLat: Math.round(g.lat * DEG_TO_SEMI),
          positionLong: Math.round(g.lng * DEG_TO_SEMI),
        };
        if (g.altM != null) rec.altitude = g.altM;
        const hr = nearestHr(a.hrSamples, g.ts);
        if (hr != null) rec.heartRate = hr;
        lastTs = ts;
        mesgs.push(rec);
      }
    } else {
      // HR-only: existing behaviour
      for (const s of hrList) {
        const ts = Utils.convertDateToDateTime(new Date(s.time * 1000));
        lastTs = ts;
        mesgs.push({ mesgNum: Profile.MesgNum.RECORD, timestamp: ts, heartRate: s.bpm });
      }
    }

    const stopTs = (a.gpsPoints.length > 0 || hrList.length) ? Math.max(lastTs, endFit) : endFit;
    mesgs.push({
      mesgNum: Profile.MesgNum.EVENT,
      timestamp: stopTs, event: "timer", eventType: "stopAll", timerTrigger: "manual",
    });

    const lap: Record<string, unknown> = {
      mesgNum: Profile.MesgNum.LAP, messageIndex: 0, timestamp: stopTs,
      startTime: startFit, totalElapsedTime: duration, totalTimerTime: duration,
      event: "lap", eventType: "stop", lapTrigger: "manual", sport, subSport,
    };
    if (a.calories     != null) lap.totalCalories = Math.round(a.calories);
    if (avgHr          != null) lap.avgHeartRate   = avgHr;
    if (maxHr          != null) lap.maxHeartRate   = maxHr;
    if (a.distanceM    != null) lap.totalDistance  = a.distanceM;
    if (a.avgSpeed     != null) lap.avgSpeed       = a.avgSpeed;
    if (a.maxSpeed     != null) lap.maxSpeed       = a.maxSpeed;
    if (a.avgCadence   != null) lap.avgCadence     = Math.round(a.avgCadence);
    if (a.maxCadence   != null) lap.maxCadence     = Math.round(a.maxCadence);
    if (a.avgPower     != null) lap.avgPower       = Math.round(a.avgPower);
    if (a.maxPower     != null) lap.maxPower       = Math.round(a.maxPower);
    if (a.totalAscent  != null) lap.totalAscent    = Math.round(a.totalAscent);
    if (a.totalDescent != null) lap.totalDescent   = Math.round(a.totalDescent);
    mesgs.push(lap);

    const session: Record<string, unknown> = {
      mesgNum: Profile.MesgNum.SESSION, messageIndex: 0, timestamp: stopTs,
      startTime: startFit, totalElapsedTime: duration, totalTimerTime: duration,
      sport, subSport, firstLapIndex: 0, numLaps: 1,
      event: "session", eventType: "stop", trigger: "activityEnd",
    };
    if (a.calories     != null) session.totalCalories = Math.round(a.calories);
    if (avgHr          != null) session.avgHeartRate   = avgHr;
    if (maxHr          != null) session.maxHeartRate   = maxHr;
    if (a.distanceM    != null) session.totalDistance  = a.distanceM;
    if (a.avgSpeed     != null) session.avgSpeed       = a.avgSpeed;
    if (a.maxSpeed     != null) session.maxSpeed       = a.maxSpeed;
    if (a.avgCadence   != null) session.avgCadence     = Math.round(a.avgCadence);
    if (a.maxCadence   != null) session.maxCadence     = Math.round(a.maxCadence);
    if (a.avgPower     != null) session.avgPower       = Math.round(a.avgPower);
    if (a.maxPower     != null) session.maxPower       = Math.round(a.maxPower);
    if (a.totalAscent  != null) session.totalAscent    = Math.round(a.totalAscent);
    if (a.totalDescent != null) session.totalDescent   = Math.round(a.totalDescent);
    mesgs.push(session);

    mesgs.push({
      mesgNum: Profile.MesgNum.ACTIVITY, timestamp: stopTs, numSessions: 1,
      localTimestamp: stopTs + start.getTimezoneOffset() * -60,
      totalTimerTime: duration, event: "activity", eventType: "stop",
    });

    const encoder = new Encoder();
    for (const m of mesgs) encoder.writeMesg(m);
    return Buffer.from(encoder.close());
  }

  filename(a: ActivityExportData, format: "tcx" | "fit"): string {
    const d = new Date(a.start * 1000);
    const date = d.toISOString().slice(0, 10);
    const slug = a.category.toLowerCase().replace(/\s+/g, "-");
    return `${date}_${slug}.${format}`;
  }
}
