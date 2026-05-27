import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type Range = "day" | "week" | "month" | "year" | "all";

@Injectable()
export class StepsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForRange(userId: string, date: string, range: Range) {
    if (range === "all") {
      const rows = await this.getAllDailySummaries(userId);
      const samples = rows.map(r => ({
        time:     Math.floor(new Date(r.date + "T00:00:00Z").getTime() / 1000),
        steps:    r.steps,
        distance: r.distance,
        calories: r.calories,
      }));
      const total    = samples.reduce((s, r) => s + r.steps, 0);
      const distance = samples.reduce((s, r) => s + r.distance, 0);
      const calories = samples.reduce((s, r) => s + r.calories, 0);
      const availableDates = await this.availableDates(userId);
      return { samples, total, distance, calories, goal: undefined, availableDates };
    }

    const end = new Date(date + "T23:59:59Z");
    const start = new Date(end);
    if (range === "day")   start.setUTCHours(0, 0, 0, 0);
    if (range === "week")  start.setUTCDate(start.getUTCDate() - 6);
    if (range === "month") start.setUTCDate(start.getUTCDate() - 29);
    if (range === "year")  start.setUTCFullYear(start.getUTCFullYear() - 1);

    type Sample = { time: number; steps: number; distance: number; calories: number };
    let samples: Sample[];  // mutable — may be filled below

    if (range === "day") {
      const rows = await this.prisma.step.findMany({
        where: { userId, ts: { gte: start, lte: end } },
        orderBy: { ts: "asc" },
        select: { ts: true, steps: true, distanceM: true, calories: true },
      });
      samples = rows.map(r => ({
        time:     Math.floor(r.ts.getTime() / 1000),
        steps:    r.steps,
        distance: r.distanceM ?? 0,
        calories: r.calories  ?? 0,
      }));
    } else {
      const rows = await this.prisma.$queryRaw<{ day: Date; steps: bigint; distance: number; calories: number }[]>`
        SELECT
          DATE_TRUNC('day', ts) AS day,
          SUM(steps)::bigint AS steps,
          COALESCE(SUM("distanceM"), 0) AS distance,
          COALESCE(SUM(calories),   0) AS calories
        FROM "Step"
        WHERE "userId" = ${userId}::uuid
          AND ts >= ${start}
          AND ts <= ${end}
        GROUP BY 1
        ORDER BY 1
      `;
      samples = rows.map(r => ({
        time:     Math.floor(new Date(r.day).getTime() / 1000),
        steps:    Number(r.steps),
        distance: Number(r.distance),
        calories: Number(r.calories),
      }));
    }

    // Fill missing days with zeros so the chart always shows the full range
    if (range !== "day") {
      const filledSamples: Sample[] = [];
      const cur = new Date(start);
      cur.setUTCHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setUTCHours(0, 0, 0, 0);
      const byDay = new Map(samples.map(s => [new Date(s.time * 1000).toISOString().slice(0, 10), s]));
      while (cur <= endDay) {
        const key = cur.toISOString().slice(0, 10);
        filledSamples.push(byDay.get(key) ?? { time: Math.floor(cur.getTime() / 1000), steps: 0, distance: 0, calories: 0 });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      samples = filledSamples;
    }

    const total    = samples.reduce((s, r) => s + r.steps, 0);
    const distance = samples.reduce((s, r) => s + r.distance, 0);
    const calories = samples.reduce((s, r) => s + r.calories, 0);

    const availableDates = await this.availableDates(userId);
    return { samples, total, distance, calories, goal: 10000, availableDates };
  }

  async getAllDailySummaries(userId: string): Promise<{ date: string; steps: number; distance: number; calories: number }[]> {
    const rows = await this.prisma.$queryRaw<{ day: Date; steps: bigint; distance: number; calories: number }[]>`
      SELECT
        DATE_TRUNC('day', ts) AS day,
        SUM(steps)::bigint AS steps,
        COALESCE(SUM("distanceM"), 0) AS distance,
        COALESCE(SUM(calories),   0) AS calories
      FROM "Step"
      WHERE "userId" = ${userId}::uuid
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map(r => ({
      date:     new Date(r.day).toISOString().slice(0, 10),
      steps:    Number(r.steps),
      distance: Number(r.distance),
      calories: Number(r.calories),
    }));
  }

  async availableDates(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ d: string }[]>`
      SELECT DISTINCT TO_CHAR(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d
      FROM "Step" WHERE "userId" = ${userId}::uuid
      ORDER BY d DESC
    `;
    return rows.map(r => r.d);
  }

  async upsertBatch(
    userId: string,
    samples: { ts: Date; steps: number; distanceM?: number; calories?: number }[],
    onProgress?: (done: number, total: number) => void,
    source?: string,
  ): Promise<number> {
    if (!samples.length) return 0;
    const deduped = Array.from(
      samples.reduce((m, s) => m.set(s.ts.getTime(), s), new Map<number, typeof samples[0]>()).values()
    );
    const CHUNK = 1000;
    let done = 0;
    for (let i = 0; i < deduped.length; i += CHUNK) {
      const chunk = deduped.slice(i, i + CHUNK);
      await this.prisma.$executeRaw`
        INSERT INTO "Step" ("userId", "ts", "steps", "distanceM", "calories", "source")
        SELECT * FROM UNNEST(
          ${chunk.map(() => userId)}::uuid[],
          ${chunk.map(s => s.ts)}::timestamptz[],
          ${chunk.map(s => s.steps)}::int[],
          ${chunk.map(s => s.distanceM ?? null)}::float8[],
          ${chunk.map(s => s.calories ?? null)}::float8[],
          ${chunk.map(() => source ?? null)}::text[]
        ) AS t("userId", "ts", "steps", "distanceM", "calories", "source")
        ON CONFLICT ("userId", "ts") DO UPDATE SET
          "source" = COALESCE(EXCLUDED."source", "Step"."source")
      `;
      done += chunk.length;
      onProgress?.(done, deduped.length);
    }
    return done;
  }
}
