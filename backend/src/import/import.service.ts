import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import { HeartRateService } from "../health/heart-rate/heart-rate.service";
import { Spo2Service } from "../health/spo2/spo2.service";
import { StepsService } from "../health/steps/steps.service";
import { SleepService } from "../health/sleep/sleep.service";
import { ActivitiesService } from "../activities/activities.service";
import { BodyService } from "../health/body/body.service";
import { PrismaService } from "../prisma/prisma.service";
import { SqliteMiFitnessStrategy, ProgressEvent } from "./strategies/sqlite-mi-fitness.strategy";
import { ZeppLifeCsvStrategy } from "./strategies/zepp-life-csv.strategy";
import { parseTcx, parseFit } from "./fit-tcx.parser";
import { calcRouteStats } from "../activities/route-calculator";

@Injectable()
export class ImportService {
  constructor(
    private readonly heartRateService: HeartRateService,
    private readonly spo2Service: Spo2Service,
    private readonly stepsService: StepsService,
    private readonly sleepService: SleepService,
    private readonly activitiesService: ActivitiesService,
    private readonly bodyService: BodyService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadFitTcx(
    files: { buffer: Buffer; originalname: string }[],
    userId: string,
  ): Promise<{ added: string[]; skipped: string[] }> {
    const user = { id: userId };
    const added: string[] = [];
    const skipped: string[] = [];

    const summary = await this.activitiesService.findAllSummary(user.id);
    const existingStarts = summary.map(a => a.start);

    for (const f of files) {
      try {
        const name = f.originalname.toLowerCase();
        const parsed =
          name.endsWith(".tcx") ? parseTcx(f.buffer.toString("utf8")) :
          name.endsWith(".fit") ? parseFit(f.buffer)                   : null;

        if (!parsed) { skipped.push(f.originalname); continue; }

        const startSec = Math.round(parsed.startTs.getTime() / 1000);
        const isDuplicate = existingStarts.some(s => Math.abs(s - startSec) < 60);
        if (isDuplicate) {
          // Re-import GPS + stats for existing activity (e.g. after GPS extraction was added)
          if (parsed.gpsPoints.length > 0) {
            const act = await this.prisma.activity.findFirst({
              where: {
                userId: user.id,
                startTs: {
                  gte: new Date((startSec - 60) * 1000),
                  lte: new Date((startSec + 60) * 1000),
                },
              },
              select: { id: true, extra: true },
            });
            if (act) {
              await this.prisma.activityGps.deleteMany({ where: { activityId: act.id } });
              await this.prisma.activityGps.createMany({
                data: parsed.gpsPoints.map((p, idx) => ({
                  activityId: act.id, idx,
                  ts: p.ts, lat: p.lat, lng: p.lng, altM: p.altM ?? null,
                })),
              });
              const routeStats = calcRouteStats(
                parsed.gpsPoints.map(p => ({ ts: p.ts, lat: p.lat, lng: p.lng, altM: p.altM })),
              );
              const prevExtra = (act.extra as Record<string, unknown>) ?? {};
              const extraPatch: Record<string, unknown> = {};
              if (parsed.avgSpeed)    extraPatch.avgSpeed    = parsed.avgSpeed;
              if (parsed.maxSpeed)    extraPatch.maxSpeed    = parsed.maxSpeed;
              if (routeStats?.avgSpeed)    extraPatch.avgSpeed    = routeStats.avgSpeed;
              if (routeStats?.maxSpeed)    extraPatch.maxSpeed    = routeStats.maxSpeed;
              if (routeStats?.totalAscent)  extraPatch.totalAscent  = routeStats.totalAscent;
              if (routeStats?.totalDescent) extraPatch.totalDescent = routeStats.totalDescent;
              await this.prisma.activity.update({
                where: { id: act.id },
                data: {
                  distanceM: parsed.distanceM ?? routeStats?.distanceM ?? undefined,
                  extra: { ...prevExtra, ...extraPatch } as any,
                },
              });
              this.activitiesService["invalidateCache"](user.id);
              added.push(f.originalname);
              continue;
            }
          }
          skipped.push(f.originalname);
          continue;
        }

        const { hrSamples, gpsPoints, distanceM, avgSpeed, maxSpeed, avgCadence, maxCadence, avgPower, maxPower, totalAscent, totalDescent, ...base } = parsed;
        const extra: Record<string, unknown> = {};
        if (avgSpeed    != null) extra.avgSpeed    = avgSpeed;
        if (maxSpeed    != null) extra.maxSpeed    = maxSpeed;
        if (avgCadence  != null) extra.avgCadence  = avgCadence;
        if (maxCadence  != null) extra.maxCadence  = maxCadence;
        if (avgPower    != null) extra.avgPower    = avgPower;
        if (maxPower    != null) extra.maxPower    = maxPower;
        if (totalAscent  != null) extra.totalAscent  = totalAscent;
        if (totalDescent != null) extra.totalDescent = totalDescent;

        await this.activitiesService.upsertBatch(user.id, [{
          ...base,
          distanceM,
          extra: Object.keys(extra).length ? extra : undefined,
          hrSamples: hrSamples.map(s => ({ ts: s.ts, bpm: s.bpm })),
        }]);

        // Save GPS points if present
        if (gpsPoints.length > 0) {
          const act = await this.prisma.activity.findFirst({
            where: { userId: user.id, startTs: parsed.startTs },
            select: { id: true },
          });
          if (act) {
            await this.prisma.activityGps.deleteMany({ where: { activityId: act.id } });
            await this.prisma.activityGps.createMany({
              data: gpsPoints.map((p, idx) => ({
                activityId: act.id, idx,
                ts: p.ts, lat: p.lat, lng: p.lng,
                altM: p.altM ?? null,
              })),
            });
          }
        }

        existingStarts.push(startSec);
        added.push(f.originalname);
      } catch (e) {
        console.error("[uploadFitTcx]", f.originalname, (e as Error).message);
        skipped.push(f.originalname);
      }
    }

    return { added, skipped };
  }

  async importZeppZip(
    zipBuffer: Buffer,
    userId: string,
    onProgress: (event: ProgressEvent) => void,
    password?: string,
  ): Promise<Record<string, number>> {
    const strategy = new ZeppLifeCsvStrategy(
      this.heartRateService,
      this.stepsService,
      this.sleepService,
      this.activitiesService,
      this.bodyService,
    );

    return strategy.import(zipBuffer, userId, onProgress, password || undefined);
  }

  async importSqliteDb(
    filePath: string,
    userId: string,
    onProgress: (event: ProgressEvent) => void,
  ): Promise<Record<string, number>> {

    const strategy = new SqliteMiFitnessStrategy(
      this.heartRateService,
      this.spo2Service,
      this.stepsService,
      this.sleepService,
      this.activitiesService,
    );

    try {
      return await strategy.import(filePath, userId, onProgress);
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  }
}
