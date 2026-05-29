import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ExportService, ActivityExportData } from "../export/export.service";
import { GpsPoint, RouteStats, calcRouteStats } from "./route-calculator";
import { parseGpx } from "./gpx.parser";

export interface ActivitySummary {
  id: string;
  category: string;
  start: number;
  title: string;
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
  ) {}

  private summaryCache: Map<string, ActivitySummary[]> = new Map();

  private invalidateCache(userId: string) {
    this.summaryCache.delete(userId);
  }

  async findAll(userId: string, limit = 30, offset = 0, source?: string) {
    const where = source ? { userId, source } : { userId };
    const [total, rows] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        orderBy: { startTs: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);
    return { total, items: rows.map(r => this.toListDto(r)) };
  }

  async findAllSummary(userId: string): Promise<ActivitySummary[]> {
    const cached = this.summaryCache.get(userId);
    if (cached) return cached;

    const rows = await this.prisma.activity.findMany({
      where: { userId },
      orderBy: { startTs: "desc" },
      select: { id: true, category: true, startTs: true, title: true, durationS: true, calories: true, distanceM: true },
    });
    const data = rows.map(r => ({
      id:        String(r.id),
      category:  r.category,
      start:     Math.floor(r.startTs.getTime() / 1000),
      title:     r.title ?? "",
      duration:  r.durationS  ?? 0,
      calories:  r.calories   ?? 0,
      distanceM: r.distanceM  ?? 0,
    }));
    this.summaryCache.set(userId, data);
    return data;
  }

  async findOne(userId: string, id: string) {
    const row = await this.prisma.activity.findFirst({
      where: { userId, id: BigInt(id) },
      include: {
        hrSamples: { orderBy: { ts: "asc" }, select: { ts: true, bpm: true } },
        gpsPoints: { orderBy: { idx: "asc" }, select: { ts: true, lat: true, lng: true, altM: true } },
      },
    });
    if (!row) throw new NotFoundException();
    return this.toDto(row);
  }

  /** Called during import: find an activity by startTs (±60s) and attach GPS points from a parsed FIT/TCX file. */
  async saveGpsForActivityByStartTs(
    userId: string,
    startTs: Date,
    gpsPoints: { ts: number; lat: number; lng: number; altM?: number }[],
    fitStats?: { distanceM?: number; avgSpeed?: number; maxSpeed?: number; totalAscent?: number; totalDescent?: number },
  ): Promise<boolean> {
    const startSec = Math.floor(startTs.getTime() / 1000);
    const act = await this.prisma.activity.findFirst({
      where: {
        userId,
        startTs: {
          gte: new Date((startSec - 60) * 1000),
          lte: new Date((startSec + 60) * 1000),
        },
      },
      select: { id: true, extra: true },
    });
    if (!act) return false;

    await this.prisma.activityGps.deleteMany({ where: { activityId: act.id } });
    await this.prisma.activityGps.createMany({
      data: gpsPoints.map((p, idx) => ({
        activityId: act.id, idx,
        ts: p.ts, lat: p.lat, lng: p.lng,
        altM: p.altM ?? null,
      })),
    });

    if (fitStats) {
      const prevExtra = (act.extra as Record<string, unknown>) ?? {};
      const extraPatch: Record<string, unknown> = {};
      if (fitStats.avgSpeed    != null) extraPatch.avgSpeed    = fitStats.avgSpeed;
      if (fitStats.maxSpeed    != null) extraPatch.maxSpeed    = fitStats.maxSpeed;
      if (fitStats.totalAscent  != null) extraPatch.totalAscent  = fitStats.totalAscent;
      if (fitStats.totalDescent != null) extraPatch.totalDescent = fitStats.totalDescent;
      await this.prisma.activity.update({
        where: { id: act.id },
        data: {
          distanceM: fitStats.distanceM ?? undefined,
          extra: { ...prevExtra, ...extraPatch } as any,
        },
      });
    }

    this.invalidateCache(userId);
    return true;
  }

  async updateRoute(userId: string, id: string, points: GpsPoint[]): Promise<{ ok: boolean; stats: RouteStats | null }> {
    const existing = await this.prisma.activity.findFirst({
      where: { userId, id: BigInt(id) },
      select: { extra: true },
    });
    if (!existing) throw new NotFoundException();

    await this.prisma.activityGps.deleteMany({ where: { activityId: BigInt(id) } });
    if (points.length > 0) {
      await this.prisma.activityGps.createMany({
        data: points.map((p, idx) => ({
          activityId: BigInt(id), idx,
          ts: p.ts, lat: p.lat, lng: p.lng,
          altM: p.altM ?? null,
        })),
      });
    }

    const stats = calcRouteStats(points);
    if (stats) {
      const prevExtra = (existing.extra as Record<string, unknown>) ?? {};
      await this.prisma.activity.updateMany({
        where: { userId, id: BigInt(id) },
        data: {
          distanceM: stats.distanceM,
          durationS: stats.durationS,
          extra: {
            ...prevExtra,
            avgSpeed:     stats.avgSpeed,
            maxSpeed:     stats.maxSpeed,
            totalAscent:  stats.totalAscent,
            totalDescent: stats.totalDescent,
          } as any,
        },
      });
    }

    this.invalidateCache(userId);
    return { ok: true, stats };
  }

  async importGpx(userId: string, id: string, buffer: Buffer): Promise<{ ok: boolean; count: number; stats: RouteStats | null }> {
    const activity = await this.prisma.activity.findFirst({
      where: { userId, id: BigInt(id) },
      select: { startTs: true },
    });
    if (!activity) throw new NotFoundException();

    const points = parseGpx(buffer.toString("utf-8"), Math.round(Number(activity.startTs)));
    if (points.length === 0) throw new BadRequestException("GPX файл не содержит точек маршрута");

    const { stats } = await this.updateRoute(userId, id, points);
    return { ok: true, count: points.length, stats };
  }

  async update(userId: string, id: string, data: { title?: string; notes?: string }) {
    await this.prisma.activity.updateMany({ where: { userId, id: BigInt(id) }, data });
    this.invalidateCache(userId);
    return { ok: true };
  }

  async fileEdit(userId: string, id: string, data: {
    sport?: string;
    title?: string;
    notes?: string;
    calories?: number;
    avgHr?: number;
    maxHr?: number;
    trainLoad?: number;
    trainEffect?: number;
    recoverTime?: number;
    distanceM?: number;
    vo2Max?: number;
    avgSpeed?: number;
    maxSpeed?: number;
    avgCadence?: number;
    maxCadence?: number;
    avgPower?: number;
    maxPower?: number;
    totalAscent?: number;
    totalDescent?: number;
    startTime?: number; // unix seconds — trim workout start
    endTime?: number;   // unix seconds — trim workout end
  }) {
    const actId = BigInt(id);
    const existing = await this.prisma.activity.findFirst({
      where: { userId, id: actId },
      select: { extra: true, startTs: true, endTs: true },
    });
    if (!existing) throw new NotFoundException();

    const { sport, avgSpeed, maxSpeed, avgCadence, maxCadence, avgPower, maxPower,
            totalAscent, totalDescent, startTime, endTime, ...schemaFields } = data;

    const origStartSec = Math.floor(existing.startTs.getTime() / 1000);
    const origEndSec   = Math.floor(existing.endTs.getTime()   / 1000);

    const newStartSec = startTime ?? origStartSec;
    const newEndSec   = endTime   ?? origEndSec;

    if (newStartSec >= newEndSec)
      throw new BadRequestException("startTime must be before endTime");

    const prevExtra = (existing.extra as Record<string, unknown>) ?? {};
    const extraPatch: Record<string, unknown> = {};
    if (avgSpeed    !== undefined) extraPatch.avgSpeed    = avgSpeed;
    if (maxSpeed    !== undefined) extraPatch.maxSpeed    = maxSpeed;
    if (avgCadence  !== undefined) extraPatch.avgCadence  = avgCadence;
    if (maxCadence  !== undefined) extraPatch.maxCadence  = maxCadence;
    if (avgPower    !== undefined) extraPatch.avgPower    = avgPower;
    if (maxPower    !== undefined) extraPatch.maxPower    = maxPower;
    if (totalAscent  !== undefined) extraPatch.totalAscent  = totalAscent;
    if (totalDescent !== undefined) extraPatch.totalDescent = totalDescent;

    const prismaData: Record<string, unknown> = { ...schemaFields };
    if (sport !== undefined) prismaData.category = sport;
    if (Object.keys(extraPatch).length > 0 || Object.keys(prevExtra).length > 0) {
      prismaData.extra = { ...prevExtra, ...extraPatch };
    }

    const trimming = newStartSec !== origStartSec || newEndSec !== origEndSec;
    if (trimming) {
      prismaData.startTs  = new Date(newStartSec * 1000);
      prismaData.endTs    = new Date(newEndSec   * 1000);
      prismaData.durationS = newEndSec - newStartSec;
    }

    // Use a transaction so activity + HR/GPS are always consistent
    await this.prisma.$transaction(async (tx) => {
      await tx.activity.updateMany({
        where: { userId, id: actId },
        data: prismaData as any,
      });

      if (trimming) {
        // Trim HR samples: delete outside [newStart, newEnd]
        await tx.activityHr.deleteMany({
          where: {
            activityId: actId,
            OR: [
              { ts: { lt: new Date(newStartSec * 1000) } },
              { ts: { gt: new Date(newEndSec   * 1000) } },
            ],
          },
        });

        // Trim GPS points: delete outside [newStart, newEnd], then renumber idx
        await tx.activityGps.deleteMany({
          where: {
            activityId: actId,
            OR: [
              { ts: { lt: newStartSec } },
              { ts: { gt: newEndSec   } },
            ],
          },
        });

        // Renumber GPS idx to keep them sequential
        const remaining = await tx.activityGps.findMany({
          where: { activityId: actId },
          orderBy: { ts: "asc" },
          select: { ts: true, lat: true, lng: true, altM: true },
        });
        if (remaining.length > 0) {
          await tx.activityGps.deleteMany({ where: { activityId: actId } });
          await tx.activityGps.createMany({
            data: remaining.map((p, idx) => ({ activityId: actId, idx, ...p })),
          });
        }
      }
    });

    this.invalidateCache(userId);
    return { ok: true, hasTcx: true, hasFit: true };
  }

  async remove(userId: string, id: string) {
    await this.prisma.activity.deleteMany({ where: { userId, id: BigInt(id) } });
    this.invalidateCache(userId);
    return { ok: true };
  }

  async download(userId: string, id: string, format: "tcx" | "fit"): Promise<{ data: string | Buffer; filename: string }> {
    const row = await this.prisma.activity.findFirst({
      where: { userId, id: BigInt(id) },
      include: {
        hrSamples: { orderBy: { ts: "asc" }, select: { ts: true, bpm: true } },
        gpsPoints: { orderBy: { idx: "asc" }, select: { ts: true, lat: true, lng: true, altM: true } },
      },
    });
    if (!row) throw new NotFoundException();

    const exportData = this.toExportData(row);
    const filename = this.exportService.filename(exportData, format);

    if (format === "tcx") {
      return { data: this.exportService.generateTcx(exportData), filename };
    } else {
      return { data: this.exportService.generateFit(exportData), filename };
    }
  }

  async upsertBatch(userId: string, activities: {
    externalSid?: string; category: string; source?: string;
    startTs: Date; endTs: Date; durationS?: number;
    calories?: number; avgHr?: number; maxHr?: number; minHr?: number;
    distanceM?: number; trainLoad?: number; trainEffect?: number;
    trainLoadLevel?: number; recoverTime?: number; vo2Max?: number;
    extra?: unknown;
    hrSamples?: { ts: Date; bpm: number }[];
  }[], onProgress?: (done: number, total: number) => void): Promise<number> {
    let count = 0;
    for (const a of activities) {
      const { hrSamples, ...fields } = a;
      const activity = await this.prisma.activity.upsert({
        where: { userId_startTs: { userId, startTs: fields.startTs } },
        update: { ...fields, extra: fields.extra as any },
        create: { userId, ...fields, extra: fields.extra as any },
      });
      if (hrSamples?.length) {
        await this.prisma.activityHr.createMany({
          data: hrSamples.map(s => ({ activityId: activity.id, ts: s.ts, bpm: s.bpm })),
          skipDuplicates: true,
        });
      }
      count++;
      onProgress?.(count, activities.length);
    }
    this.invalidateCache(userId);
    return count;
  }

  /** Attaches HeartRate DB records to a single activity and returns the resulting samples + updated stats. */
  async attachHrFromDb(userId: string, id: string): Promise<{
    count: number;
    avgHr: number;
    maxHr: number;
    samples: { time: number; bpm: number }[];
  }> {
    const activity = await this.prisma.activity.findFirst({
      where: { userId, id: BigInt(id) },
      select: { startTs: true, endTs: true },
    });
    if (!activity) throw new NotFoundException();

    const inserted = await this.prisma.$executeRaw`
      INSERT INTO "ActivityHr" ("activityId", "ts", "bpm")
      SELECT ${BigInt(id)}, hr."ts", hr."bpm"
      FROM "HeartRate" hr
      WHERE hr."userId" = ${userId}::uuid
        AND hr."ts" >= ${activity.startTs}
        AND hr."ts" <= ${activity.endTs}
      ON CONFLICT ("activityId", "ts") DO NOTHING
    `;

    const count = Number(inserted);
    if (count === 0) {
      return { count: 0, avgHr: 0, maxHr: 0, samples: [] };
    }

    const [aggResult, rows] = await Promise.all([
      this.prisma.activityHr.aggregate({
        where: { activityId: BigInt(id) },
        _avg: { bpm: true },
        _max: { bpm: true },
      }),
      this.prisma.activityHr.findMany({
        where: { activityId: BigInt(id) },
        orderBy: { ts: "asc" },
        select: { ts: true, bpm: true },
      }),
    ]);

    const avgHr = Math.round(aggResult._avg.bpm ?? 0);
    const maxHr = Math.round(aggResult._max.bpm ?? 0);

    await this.prisma.activity.updateMany({
      where: { userId, id: BigInt(id) },
      data: { avgHr, maxHr },
    });

    this.invalidateCache(userId);
    return {
      count,
      avgHr,
      maxHr,
      samples: rows.map(r => ({ time: Math.floor(r.ts.getTime() / 1000), bpm: r.bpm })),
    };
  }

  /** Returns max timestamps already in DB for each import type — used to skip re-importing old data. */
  async getImportMaxTimestamps(userId: string): Promise<{
    heartRate?: Date; spo2?: Date; steps?: Date; sleep?: Date; activities?: Date;
  }> {
    const uid = userId;
    const [hr, spo2, step, sleep, act] = await Promise.all([
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(ts) AS max FROM "HeartRate" WHERE "userId" = ${uid}::uuid`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(ts) AS max FROM "Spo2" WHERE "userId" = ${uid}::uuid`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(ts) AS max FROM "Step" WHERE "userId" = ${uid}::uuid`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(bedtime) AS max FROM "Sleep" WHERE "userId" = ${uid}::uuid`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX("startTs") AS max FROM "Activity" WHERE "userId" = ${uid}::uuid`,
    ]);
    return {
      heartRate:  hr[0]?.max   ?? undefined,
      spo2:       spo2[0]?.max ?? undefined,
      steps:      step[0]?.max ?? undefined,
      sleep:      sleep[0]?.max ?? undefined,
      activities: act[0]?.max  ?? undefined,
    };
  }

  async getImportMaxTimestampsBySource(userId: string, source: string): Promise<{
    heartRate?: Date; steps?: Date; sleep?: Date; activities?: Date; body?: Date;
  }> {
    const uid = userId;
    const [hr, step, sleep, act, body] = await Promise.all([
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(ts) AS max FROM "HeartRate" WHERE "userId" = ${uid}::uuid AND source = ${source}`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(ts) AS max FROM "Step" WHERE "userId" = ${uid}::uuid AND source = ${source}`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(bedtime) AS max FROM "Sleep" WHERE "userId" = ${uid}::uuid AND source = ${source}`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX("startTs") AS max FROM "Activity" WHERE "userId" = ${uid}::uuid AND source = ${source}`,
      this.prisma.$queryRaw<{ max: Date | null }[]>`SELECT MAX(ts) AS max FROM "BodyComposition" WHERE "userId" = ${uid}::uuid AND source = ${source}`,
    ]);
    return {
      heartRate:  hr[0]?.max   ?? undefined,
      steps:      step[0]?.max ?? undefined,
      sleep:      sleep[0]?.max ?? undefined,
      activities: act[0]?.max  ?? undefined,
      body:       body[0]?.max ?? undefined,
    };
  }

  /** Links HR samples from the HeartRate table into ActivityHr for all activities of a user. */
  async linkHeartRateFromGlobal(userId: string): Promise<number> {
    const result = await this.prisma.$executeRaw`
      INSERT INTO "ActivityHr" ("activityId", "ts", "bpm")
      SELECT a.id, hr.ts, hr.bpm
      FROM "Activity" a
      JOIN "HeartRate" hr
        ON hr."userId" = a."userId"
        AND hr.ts >= a."startTs"
        AND hr.ts <= a."endTs"
      WHERE a."userId" = ${userId}::uuid
      ON CONFLICT ("activityId", "ts") DO NOTHING
    `;
    return Number(result);
  }

  private toListDto(row: any) {
    const extra = (row.extra as Record<string, unknown>) ?? {};
    return {
      id:              String(row.id),
      category:        row.category,
      source:          row.source ?? null,
      start:           Math.floor(row.startTs.getTime() / 1000),
      end:             Math.floor(row.endTs.getTime()   / 1000),
      duration:        row.durationS ?? 0,
      calories:        row.calories ?? 0,
      avgHr:           row.avgHr ?? 0,
      maxHr:           row.maxHr ?? 0,
      minHr:           row.minHr ?? 0,
      trainLoad:       row.trainLoad ?? 0,
      trainEffect:     row.trainEffect ?? 0,
      trainLoadLevel:  row.trainLoadLevel ?? 0,
      recoverTime:     row.recoverTime ?? 0,
      hrZones: {
        warmUp:    Number(extra.hrm_warm_up_duration    ?? 0),
        fatBurn:   Number(extra.hrm_fat_burning_duration ?? 0),
        aerobic:   Number(extra.hrm_aerobic_duration    ?? 0),
        anaerobic: Number(extra.hrm_anaerobic_duration  ?? 0),
        extreme:   Number(extra.hrm_extreme_duration    ?? 0),
      },
      title:  row.title ?? "",
      notes:  row.notes ?? "",
      hasTcx: true,
      hasFit: true,
    };
  }

  private toExportData(row: any): ActivityExportData {
    const extra = (row.extra as Record<string, unknown>) ?? {};
    return {
      id:           String(row.id),
      externalSid:  row.externalSid,
      category:     row.category,
      start:        Math.floor(row.startTs.getTime() / 1000),
      end:          Math.floor(row.endTs.getTime()   / 1000),
      durationS:    row.durationS ?? 0,
      calories:     row.calories,
      avgHr:        row.avgHr,
      maxHr:        row.maxHr,
      distanceM:    row.distanceM   ?? (extra.distanceM  as number ?? null),
      avgSpeed:     extra.avgSpeed   as number ?? null,
      maxSpeed:     extra.maxSpeed   as number ?? null,
      avgCadence:   extra.avgCadence as number ?? null,
      maxCadence:   extra.maxCadence as number ?? null,
      avgPower:     extra.avgPower   as number ?? null,
      maxPower:     extra.maxPower   as number ?? null,
      totalAscent:  extra.totalAscent  as number ?? null,
      totalDescent: extra.totalDescent as number ?? null,
      extra:        row.extra as Record<string, unknown>,
      hrSamples:    (row.hrSamples ?? []).map((s: any) => ({
        time: Math.floor(s.ts.getTime() / 1000),
        bpm:  s.bpm,
      })),
      gpsPoints: (row.gpsPoints ?? []).map((g: any) => ({
        ts:   g.ts,
        lat:  g.lat,
        lng:  g.lng,
        altM: g.altM ?? null,
      })),
    };
  }

  private toDto(row: any) {
    const extra = (row.extra as Record<string, unknown>) ?? {};
    return {
      id:              String(row.id),
      uid:             row.externalSid ?? String(row.id),
      sid:             row.externalSid ?? String(row.id),
      category:        row.category,
      categoryOriginal: row.category,
      source:          row.source ?? null,
      start:           Math.floor(row.startTs.getTime() / 1000),
      end:             Math.floor(row.endTs.getTime()   / 1000),
      duration:        row.durationS ?? 0,
      calories:        row.calories ?? 0,
      avgHr:           row.avgHr ?? 0,
      maxHr:           row.maxHr ?? 0,
      minHr:           row.minHr ?? 0,
      trainLoad:       row.trainLoad ?? 0,
      trainEffect:     row.trainEffect ?? 0,
      trainLoadLevel:  row.trainLoadLevel ?? 0,
      recoverTime:     row.recoverTime ?? 0,
      distanceM:       row.distanceM ?? 0,
      vo2Max:          row.vo2Max ?? null,
      avgSpeed:        (extra.avgSpeed    as number) ?? null,
      maxSpeed:        (extra.maxSpeed    as number) ?? null,
      avgCadence:      (extra.avgCadence  as number) ?? null,
      maxCadence:      (extra.maxCadence  as number) ?? null,
      avgPower:        (extra.avgPower    as number) ?? null,
      maxPower:        (extra.maxPower    as number) ?? null,
      totalAscent:     (extra.totalAscent  as number) ?? null,
      totalDescent:    (extra.totalDescent as number) ?? null,
      hrZones: {
        warmUp:    Number(extra.hrm_warm_up_duration    ?? 0),
        fatBurn:   Number(extra.hrm_fat_burning_duration ?? 0),
        aerobic:   Number(extra.hrm_aerobic_duration    ?? 0),
        anaerobic: Number(extra.hrm_anaerobic_duration  ?? 0),
        extreme:   Number(extra.hrm_extreme_duration    ?? 0),
      },
      title:     row.title ?? "",
      notes:     row.notes ?? "",
      hasTcx:    true,
      hasFit:    true,
      overrides: {},
      hrSamples: (row.hrSamples ?? []).map((s: any) => ({
        time: Math.floor(s.ts.getTime() / 1000),
        bpm:  s.bpm,
      })),
      gpsPoints: (row.gpsPoints ?? []).map((g: any) => ({
        ts:  g.ts,
        lat: g.lat,
        lng: g.lng,
        alt: g.altM ?? undefined,
      })),
    };
  }
}
