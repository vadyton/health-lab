import { Module } from "@nestjs/common";
import { ActivitiesService } from "./activities.service";
import { ActivitiesController } from "./activities.controller";
import { UsersModule } from "../users/users.module";
import { ExportService } from "../export/export.service";

@Module({
  imports: [UsersModule],
  providers: [ActivitiesService, ExportService],
  controllers: [ActivitiesController],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
