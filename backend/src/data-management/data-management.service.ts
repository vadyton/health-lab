import { Injectable } from "@nestjs/common";
import AdmZip from "adm-zip";
import { PrismaService } from "../prisma/prisma.service";
import { ExportService } from "../export/export.service";

export const KNOWN_SOURCES = ["zepp_life", "mi_fitness"] as const;
export type DataSource = typeof KNOWN_SOURCES[number];

export const SOURCE_LABELS: Record<DataSource, string> = {
  zepp_life:  "Zepp Life",
  mi_fitness: "Mi Fitness",
};

@Injectable()
export class DataManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
  ) {}

  async getSourceStats(userId: string): Promise<Record<string, Record<string, number>>> {
    const result: Record<string, Record<string, number>> = {};
    for (const source of KNOWN_SOURCES) {
      result[source] = {
        heartRate:  await this.prisma.heartRate.count({ where: { userId, source } }),
        steps:      await this.prisma.step.count({ where: { userId, source } }),
        sleep:      await this.prisma.sleep.count({ where: { userId, source } }),
        activities: await this.prisma.activity.count({ where: { userId, source } }),
        body:       await this.prisma.bodyComposition.count({ where: { userId, source } }),
      };
    }
    return result;
  }

  async deleteBySource(userId: string, source: DataSource, types?: string[]): Promise<Record<string, number>> {
    const all = !types?.length;
    const has = (t: string) => all || types!.includes(t);
    const [hr, steps, sleep, activities, body] = await Promise.all([
      has("heartRate")  ? this.prisma.heartRate.deleteMany({ where: { userId, source } })         : { count: 0 },
      has("steps")      ? this.prisma.step.deleteMany({ where: { userId, source } })               : { count: 0 },
      has("sleep")      ? this.prisma.sleep.deleteMany({ where: { userId, source } })              : { count: 0 },
      has("activities") ? this.prisma.activity.deleteMany({ where: { userId, source } })           : { count: 0 },
      has("body")       ? this.prisma.bodyComposition.deleteMany({ where: { userId, source } })    : { count: 0 },
    ]);
    return {
      heartRate:  hr.count,
      steps:      steps.count,
      sleep:      sleep.count,
      activities: activities.count,
      body:       body.count,
    };
  }

  /** Export activities as a ZIP of FIT or TCX files, one file per activity. */
  async exportActivitiesZip(
    userId: string,
    format: "tcx" | "fit",
    sources?: string[],
  ): Promise<Buffer> {
    const where = sources?.length
      ? { userId, source: { in: sources } }
      : { userId };

    // Load in chunks to avoid pulling millions of HR rows at once
    const CHUNK = 50;
    let offset = 0;
    const zip = new AdmZip();
    const usedNames = new Map<string, number>();

    while (true) {
      const rows = await this.prisma.activity.findMany({
        where,
        orderBy: { startTs: "asc" },
        skip: offset,
        take: CHUNK,
        include: {
          hrSamples: { orderBy: { ts: "asc" }, select: { ts: true, bpm: true } },
          gpsPoints: { orderBy: { idx: "asc" }, select: { ts: true, lat: true, lng: true, altM: true } },
        },
      });

      if (!rows.length) break;
      offset += rows.length;

      for (const row of rows) {
        const extra = (row.extra as Record<string, unknown>) ?? {};
        const exportData = {
          id:          String(row.id),
          externalSid: row.externalSid,
          category:    row.category,
          start:       Math.floor(row.startTs.getTime() / 1000),
          end:         Math.floor(row.endTs.getTime()   / 1000),
          durationS:   row.durationS ?? 0,
          calories:    row.calories,
          avgHr:       row.avgHr,
          maxHr:       row.maxHr,
          distanceM:   row.distanceM   ?? (extra.distanceM  as number ?? null),
          avgSpeed:    extra.avgSpeed   as number ?? null,
          maxSpeed:    extra.maxSpeed   as number ?? null,
          avgCadence:  extra.avgCadence as number ?? null,
          maxCadence:  extra.maxCadence as number ?? null,
          avgPower:    extra.avgPower   as number ?? null,
          maxPower:    extra.maxPower   as number ?? null,
          totalAscent:  extra.totalAscent  as number ?? null,
          totalDescent: extra.totalDescent as number ?? null,
          extra,
          hrSamples: row.hrSamples.map(s => ({
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

        let baseName = this.exportService.filename(exportData, format);
        // Deduplicate filenames (same category + same date)
        const count = usedNames.get(baseName) ?? 0;
        usedNames.set(baseName, count + 1);
        if (count > 0) {
          baseName = baseName.replace(`.${format}`, `_${count}.${format}`);
        }

        const data = format === "tcx"
          ? Buffer.from(this.exportService.generateTcx(exportData), "utf8")
          : this.exportService.generateFit(exportData);

        zip.addFile(baseName, data);
      }

      if (rows.length < CHUNK) break;
    }

    return zip.toBuffer();
  }
}
