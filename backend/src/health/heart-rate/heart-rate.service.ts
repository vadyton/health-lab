import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Range = "day" | "week" | "month" | "year";

// Bucket sizes: day=1min, week=15min, month=1h, year=6h
const BUCKET_SECONDS: Record<Range, number> = {
  day: 60, week: 900, month: 3600, year: 21600,
};

@Injectable()
export class HeartRateService {
  constructor(private readonly prisma: PrismaService) {}

  async getForRange(userId: string, date: string, range: Range) {
    const end = new Date(date + "T23:59:59Z");
    const start = new Date(end);
    if (range === "day")   start.setUTCHours(0, 0, 0, 0);
    if (range === "week")  start.setUTCDate(start.getUTCDate() - 6);
    if (range === "month") start.setUTCDate(start.getUTCDate() - 29);
    if (range === "year")  start.setUTCFullYear(start.getUTCFullYear() - 1);

    const b = Prisma.raw(String(BUCKET_SECONDS[range]));

    const rows = await this.prisma.$queryRaw<{ time: Date; bpm: number }[]>`
      SELECT
        TO_TIMESTAMP(FLOOR(EXTRACT(EPOCH FROM ts) / ${b}) * ${b}) AS time,
        ROUND(AVG(bpm))::integer AS bpm
      FROM "HeartRate"
      WHERE "userId" = ${userId}::uuid
        AND ts >= ${start}
        AND ts <= ${end}
      GROUP BY 1
      ORDER BY 1
    `;

    const samples = rows.map(r => ({
      time: Math.floor(new Date(r.time).getTime() / 1000),
      bpm:  Number(r.bpm),
    }));

    let sum = 0, min = Infinity, max = -Infinity;
    for (const s of samples) {
      sum += s.bpm;
      if (s.bpm < min) min = s.bpm;
      if (s.bpm > max) max = s.bpm;
    }
    const n = samples.length;
    const avg = n ? Math.round(sum / n) : 0;

    const availableDates = await this.availableDates(userId);
    return { samples, avg, min: n ? min : 0, max: n ? max : 0, availableDates };
  }

  async availableDates(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ d: string }[]>`
      SELECT DISTINCT TO_CHAR(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d
      FROM "HeartRate" WHERE "userId" = ${userId}::uuid
      ORDER BY d DESC
    `;
    return rows.map(r => r.d);
  }

  async upsertBatch(
    userId: string,
    samples: { ts: Date; bpm: number }[],
    onProgress?: (done: number, total: number) => void,
    source?: string,
  ): Promise<number> {
    if (!samples.length) return 0;
    const CHUNK = 1000;
    let done = 0;
    for (let i = 0; i < samples.length; i += CHUNK) {
      const chunk = samples.slice(i, i + CHUNK);
      await this.prisma.$executeRaw`
        INSERT INTO "HeartRate" ("userId", "ts", "bpm", "source")
        SELECT * FROM UNNEST(
          ${chunk.map(() => userId)}::uuid[],
          ${chunk.map(s => s.ts)}::timestamptz[],
          ${chunk.map(s => s.bpm)}::smallint[],
          ${chunk.map(() => source ?? null)}::text[]
        ) AS t("userId", "ts", "bpm", "source")
        ON CONFLICT ("userId", "ts") DO UPDATE SET
          "source" = COALESCE(EXCLUDED."source", "HeartRate"."source")
      `;
      done += chunk.length;
      onProgress?.(done, samples.length);
    }
    return done;
  }
}
