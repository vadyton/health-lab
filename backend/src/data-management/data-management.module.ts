import { Module } from "@nestjs/common";
import { DataManagementService } from "./data-management.service";
import { DataManagementController } from "./data-management.controller";
import { ExportService } from "../export/export.service";

@Module({
  providers: [DataManagementService, ExportService],
  controllers: [DataManagementController],
})
export class DataManagementModule {}
