import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type Range = "month" | "year" | "all";

@Injectable()
export class BodyService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertBatch(
    userId: string,
    records: {
      ts: Date;
      weightKg: number;
      heightCm?: number;
      bmi?: number;
      fatRate?: number;
      bodyWaterRate?: number;
      boneMassKg?: number;
      metabolism?: number;
      muscleRate?: number;
      visceralFat?: number;
    }[],
    onProgress?: (done: number, total: number) => void,
    source?: string,
  ): Promise<number> {
    if (!records.length) return 0;
    let done = 0;
    for (const r of records) {
      await this.prisma.bodyComposition.upsert({
        where: { userId_ts: { userId, ts: r.ts } },
        update: { ...r, source: source ?? undefined },
        create: { userId, ...r, source: source ?? undefined },
      });
      done++;
      onProgress?.(done, records.length);
    }
    return done;
  }

  async getLatest(userId: string) {
    return this.prisma.bodyComposition.findFirst({
      where: { userId },
      orderBy: { ts: "desc" },
    });
  }

  async getForRange(userId: string, date: string, range: Range) {
    const end = new Date(date + "T23:59:59Z");
    const start = new Date(end);
    if (range === "month") start.setUTCDate(start.getUTCDate() - 29);
    else if (range === "year") start.setUTCFullYear(start.getUTCFullYear() - 1);
    else start.setFullYear(2000);

    const rows = await this.prisma.bodyComposition.findMany({
      where: { userId, ts: { gte: start, lte: end } },
      orderBy: { ts: "asc" },
      select: {
        ts: true, weightKg: true, heightCm: true, bmi: true,
        fatRate: true, bodyWaterRate: true, boneMassKg: true,
        metabolism: true, muscleRate: true, visceralFat: true,
      },
    });

    const samples = rows.map(r => ({
      time:         Math.floor(r.ts.getTime() / 1000),
      weightKg:     r.weightKg,
      heightCm:     r.heightCm  ?? null,
      bmi:          r.bmi       ?? null,
      fatRate:      r.fatRate   ?? null,
      bodyWaterRate: r.bodyWaterRate ?? null,
      boneMassKg:   r.boneMassKg ?? null,
      metabolism:   r.metabolism ?? null,
      muscleRate:   r.muscleRate ?? null,
      visceralFat:  r.visceralFat ?? null,
    }));

    const latest = samples.length > 0 ? samples[samples.length - 1] : null;
    const availableDates = await this.availableDates(userId);

    return { samples, latest, availableDates };
  }

  private async availableDates(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ d: string }[]>`
      SELECT DISTINCT DATE_TRUNC('month', ts)::date::text AS d
      FROM "BodyComposition"
      WHERE "userId" = ${userId}::uuid
      ORDER BY d DESC
    `;
    return rows.map(r => r.d);
  }
}
