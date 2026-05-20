import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SleepService {
  constructor(private readonly prisma: PrismaService) {}

  async getList(userId: string, limit = 60, offset = 0) {
    const [total, records] = await Promise.all([
      this.prisma.sleep.count({ where: { userId } }),
      this.prisma.sleep.findMany({
        where: { userId },
        orderBy: { bedtime: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      total,
      records: records.map(r => this.toFullDto(r)),
    };
  }

  async getSummary(userId: string) {
    const rows = await this.prisma.sleep.findMany({
      where: { userId },
      orderBy: { bedtime: "desc" },
      select: {
        id: true, bedtime: true, wakeUp: true,
        durationMin: true, deepMin: true, lightMin: true, remMin: true,
        score: true, avgHr: true,
      },
    });
    return rows.map(r => ({
      id:            String(r.id),
      bedtime:       Math.floor(r.bedtime.getTime() / 1000),
      wakeUpTime:    Math.floor(r.wakeUp.getTime()  / 1000),
      totalDuration: r.durationMin ?? 0,
      deepDuration:  r.deepMin     ?? 0,
      lightDuration: r.lightMin    ?? 0,
      remDuration:   r.remMin      ?? 0,
      score:         r.score  ?? undefined,
      avgHr:         r.avgHr  ?? undefined,
    }));
  }

  async getOne(userId: string, id: string) {
    const r = await this.prisma.sleep.findFirst({ where: { userId, id: BigInt(id) } });
    if (!r) throw new NotFoundException();
    return this.toFullDto(r);
  }

  async upsertBatch(userId: string, records: {
    bedtime: Date; wakeUp: Date; durationMin?: number;
    deepMin?: number; lightMin?: number; remMin?: number;
    awakeMin?: number; awakeCount?: number;
    avgHr?: number; minHr?: number; maxHr?: number;
    avgSpo2?: number; minSpo2?: number;
    score?: number; avgBreath?: number;
    stages?: unknown; naps?: unknown;
  }[], onProgress?: (done: number, total: number) => void, source?: string): Promise<number> {
    let count = 0;
    for (const rec of records) {
      const { stages, naps, ...rest } = rec;
      const data = {
        ...rest,
        stages: stages as any ?? undefined,
        naps:   naps   as any ?? undefined,
        source: source ?? undefined,
      };
      await this.prisma.sleep.upsert({
        where: { userId_bedtime: { userId, bedtime: data.bedtime } },
        update: data,
        create: { userId, ...data },
      });
      count++;
      onProgress?.(count, records.length);
    }
    return count;
  }

  private toFullDto(r: any) {
    return {
      id:            String(r.id),
      bedtime:       Math.floor(r.bedtime.getTime() / 1000),
      wakeUpTime:    Math.floor(r.wakeUp.getTime()  / 1000),
      totalDuration: r.durationMin ?? 0,
      deepDuration:  r.deepMin     ?? 0,
      lightDuration: r.lightMin    ?? 0,
      remDuration:   r.remMin      ?? 0,
      avgHr:         r.avgHr       ?? undefined,
      minHr:         r.minHr       ?? undefined,
      maxHr:         r.maxHr       ?? undefined,
      avgSpo2:       r.avgSpo2     ?? undefined,
      minSpo2:       r.minSpo2     ?? undefined,
      score:         r.score       ?? undefined,
      awakeCount:    r.awakeCount  ?? undefined,
      avgBreath:     r.avgBreath   ?? undefined,
      stages:        r.stages,
      naps:          r.naps ?? undefined,
    };
  }
}
