import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type Range = "day" | "week" | "month" | "year";

@Injectable()
export class Spo2Service {
  constructor(private readonly prisma: PrismaService) {}

  async getForRange(userId: string, date: string, range: Range) {
    const end = new Date(date + "T23:59:59Z");
    const start = new Date(end);
    if (range === "day")   start.setUTCHours(0, 0, 0, 0);
    if (range === "week")  start.setUTCDate(start.getUTCDate() - 6);
    if (range === "month") start.setUTCDate(start.getUTCDate() - 29);
    if (range === "year")  start.setUTCFullYear(start.getUTCFullYear() - 1);

    const rows = await this.prisma.spo2.findMany({
      where: { userId, ts: { gte: start, lte: end } },
      orderBy: { ts: "asc" },
      select: { ts: true, value: true },
    });

    const samples = rows.map(r => ({ time: Math.floor(r.ts.getTime() / 1000), spo2: r.value }));
    const vals = samples.map(s => s.spo2);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;

    const availableDates = await this.availableDates(userId);
    return { samples, avg, min, max, availableDates };
  }

  async availableDates(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ d: string }[]>`
      SELECT DISTINCT TO_CHAR(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d
      FROM "Spo2" WHERE "userId" = ${userId}::uuid
      ORDER BY d DESC
    `;
    return rows.map(r => r.d);
  }

  async upsertBatch(
    userId: string,
    samples: { ts: Date; value: number }[],
    onProgress?: (done: number, total: number) => void,
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
        INSERT INTO "Spo2" ("userId", "ts", "value")
        SELECT * FROM UNNEST(
          ${chunk.map(() => userId)}::uuid[],
          ${chunk.map(s => s.ts)}::timestamptz[],
          ${chunk.map(s => s.value)}::smallint[]
        ) AS t("userId", "ts", "value")
        ON CONFLICT ("userId", "ts") DO NOTHING
      `;
      done += chunk.length;
      onProgress?.(done, deduped.length);
    }
    return done;
  }
}
