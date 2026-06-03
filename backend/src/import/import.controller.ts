import {
  Controller, Post, UseInterceptors, UploadedFile, UploadedFiles, Res, HttpCode, UseGuards, Body,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage, memoryStorage } from "multer";
import { Response } from "express";
import * as os from "os";
import { ImportService } from "./import.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CU } from "../auth/current-user.decorator";
import { parseFit, parseTcx } from "./fit-tcx.parser";
import { parseGpx } from "../activities/gpx.parser";

@UseGuards(JwtAuthGuard)
@Controller("api/import")
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post("parse-file")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async parseFile(@UploadedFile() file: Express.Multer.File) {
    const lower = file.originalname.toLowerCase();
    let hrSamples: { ts: number; bpm: number }[] = [];
    let gpsPoints: { ts: number; lat: number; lng: number; alt?: number }[] = [];
    let meta: Record<string, unknown> = { filename: file.originalname };

    if (lower.endsWith(".gpx")) {
      const pts = parseGpx(file.buffer.toString("utf-8"));
      gpsPoints = pts.map(p => ({ ts: p.ts, lat: p.lat, lng: p.lng, alt: p.altM ?? undefined }));
      meta.type = "gpx";
    } else if (lower.endsWith(".tcx")) {
      const parsed = parseTcx(file.buffer.toString("utf-8"));
      if (parsed) {
        hrSamples = parsed.hrSamples.map(s => ({ ts: Math.round(s.ts.getTime() / 1000), bpm: s.bpm }));
        gpsPoints = parsed.gpsPoints.map(p => ({ ts: p.ts, lat: p.lat, lng: p.lng, alt: p.altM ?? undefined }));
        meta = { ...meta, type: "tcx", category: parsed.category, durationS: parsed.durationS,
          avgHr: parsed.avgHr, maxHr: parsed.maxHr, distanceM: parsed.distanceM,
          calories: parsed.calories, startTs: parsed.startTs };
      }
    } else if (lower.endsWith(".fit")) {
      const parsed = parseFit(file.buffer);
      if (parsed) {
        hrSamples = parsed.hrSamples.map(s => ({ ts: Math.round(s.ts.getTime() / 1000), bpm: s.bpm }));
        gpsPoints = parsed.gpsPoints.map(p => ({ ts: p.ts, lat: p.lat, lng: p.lng, alt: p.altM ?? undefined }));
        meta = { ...meta, type: "fit", category: parsed.category, durationS: parsed.durationS,
          avgHr: parsed.avgHr, maxHr: parsed.maxHr, distanceM: parsed.distanceM,
          calories: parsed.calories, startTs: parsed.startTs };
      }
    } else {
      return { error: "Неподдерживаемый формат. Используйте .fit, .tcx или .gpx" };
    }

    return { hrSamples, gpsPoints, meta };
  }

  @Post("upload-fit-tcx")
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor("files", 100, { storage: memoryStorage() }))
  async uploadFitTcx(@CurrentUser() user: CU, @UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) return { added: [], skipped: [] };
    return this.importService.uploadFitTcx(
      files.map(f => ({ buffer: f.buffer, originalname: f.originalname })),
      user.id,
    );
  }

  @Post("zepp-zip")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async importZeppZip(@CurrentUser() user: CU, @UploadedFile() file: Express.Multer.File, @Body("password") password: string, @Res() res: Response) {
    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders();

    const send = (data: object) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (!file) {
      send({ type: "error", message: "Файл не загружен" });
      res.end();
      return;
    }

    send({ type: "start", message: "Начало импорта Zepp Life CSV…" });

    try {
      const stats = await this.importService.importZeppZip(
        file.buffer,
        user.id,
        event => send({ type: "progress", ...event }),
        password,
      );
      send({ type: "done", stats });
    } catch (e: unknown) {
      send({ type: "error", message: (e as Error).message });
    } finally {
      res.end();
    }
  }

  @Post("sqlite")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) => cb(null, `mifitness-${Date.now()}.db`),
    }),
  }))
  async importSqlite(@CurrentUser() user: CU, @UploadedFile() file: Express.Multer.File, @Res() res: Response) {
    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders();

    const send = (data: object) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (!file) {
      send({ type: "error", message: "Файл не загружен" });
      res.end();
      return;
    }

    send({ type: "start", message: "Начало импорта Mi Fitness SQLite…" });

    try {
      const stats = await this.importService.importSqliteDb(
        file.path,
        user.id,
        event => send({ type: "progress", ...event }),
      );
      send({ type: "done", stats });
    } catch (e: unknown) {
      send({ type: "error", message: (e as Error).message });
    } finally {
      res.end();
    }
  }
}
