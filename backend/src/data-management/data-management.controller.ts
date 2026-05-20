import { Controller, Get, Delete, Query, Res, UseGuards, BadRequestException } from "@nestjs/common";
import { Response } from "express";
import { DataManagementService, KNOWN_SOURCES, DataSource } from "./data-management.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CU } from "../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/data")
export class DataManagementController {
  constructor(private readonly dataManagementService: DataManagementService) {}

  @Get("sources")
  async getSourceStats(@CurrentUser() user: CU) {
    return this.dataManagementService.getSourceStats(user.id);
  }

  @Delete("source")
  async deleteBySource(
    @CurrentUser() user: CU,
    @Query("source") source: string,
    @Query("types") typesStr?: string,
  ) {
    if (!KNOWN_SOURCES.includes(source as DataSource)) {
      throw new BadRequestException(`Unknown source: ${source}. Valid: ${KNOWN_SOURCES.join(", ")}`);
    }
    const types = typesStr ? typesStr.split(",").filter(Boolean) : undefined;
    return this.dataManagementService.deleteBySource(user.id, source as DataSource, types);
  }

  @Get("export/activities")
  async exportActivities(
    @CurrentUser() user: CU,
    @Query("sources") sources: string,
    @Query("format")  format: string,
    @Res() res: Response,
  ) {
    const sourcesArr = sources ? sources.split(",").filter(Boolean) : undefined;
    const fmt = format === "fit" ? "fit" : "tcx";
    const zip = await this.dataManagementService.exportActivitiesZip(user.id, fmt, sourcesArr);
    const suffix = sourcesArr?.length ? `_${sourcesArr.join("_")}` : "_all";
    const filename = `activities${suffix}_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(zip);
  }
}
