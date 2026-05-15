import { Controller, Get, Put, Post, Delete, Param, Body, Query, Res, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Response } from "express";
import { ActivitiesService } from "./activities.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CU } from "../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/activities")
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get("summary")
  async findAllSummary(@CurrentUser() user: CU) {
    return this.activitiesService.findAllSummary(user.id);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CU,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("source") source?: string,
  ) {
    return this.activitiesService.findAll(
      user.id,
      limit ? Number(limit) : 30,
      offset ? Number(offset) : 0,
      source,
    );
  }

  @Get(":id")
  async findOne(@CurrentUser() user: CU, @Param("id") id: string, @Query("format") format?: string, @Res() res?: Response) {
    if (format === "tcx" || format === "fit") {
      const { data, filename } = await this.activitiesService.download(user.id, id, format);
      const contentType = format === "tcx" ? "application/xml" : "application/octet-stream";
      res!.setHeader("Content-Type", contentType);
      res!.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res!.send(data);
      return;
    }
    return res!.json(await this.activitiesService.findOne(user.id, id));
  }

  @Get(":id/download")
  async download(@CurrentUser() user: CU, @Param("id") id: string, @Query("format") format = "tcx", @Res() res: Response) {
    const { data, filename } = await this.activitiesService.download(user.id, id, format as "tcx" | "fit");
    const contentType = format === "tcx" ? "application/xml" : "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(data);
  }

  @Post(":id/attach-hr-from-db")
  async attachHrFromDb(@CurrentUser() user: CU, @Param("id") id: string) {
    return this.activitiesService.attachHrFromDb(user.id, id);
  }

  @Post(":id/import-gpx")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage() }))
  async importGpx(@CurrentUser() user: CU, @Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    return this.activitiesService.importGpx(user.id, id, file.buffer);
  }

  @Put(":id/route")
  async updateRoute(
    @CurrentUser() user: CU,
    @Param("id") id: string,
    @Body() body: { points: { ts: number; lat: number; lng: number; altM?: number | null }[] },
  ) {
    return this.activitiesService.updateRoute(user.id, id, body.points ?? []);
  }

  @Put(":id/file-edit")
  async fileEdit(@CurrentUser() user: CU, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.activitiesService.fileEdit(user.id, id, body as any);
  }

  @Put(":id")
  async update(@CurrentUser() user: CU, @Param("id") id: string, @Body() body: { title?: string; notes?: string }) {
    return this.activitiesService.update(user.id, id, body);
  }

  @Delete(":id")
  async remove(@CurrentUser() user: CU, @Param("id") id: string) {
    return this.activitiesService.remove(user.id, id);
  }
}
