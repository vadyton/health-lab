import { Module } from "@nestjs/common";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";
import { HeartRateModule } from "../health/heart-rate/heart-rate.module";
import { Spo2Module } from "../health/spo2/spo2.module";
import { StepsModule } from "../health/steps/steps.module";
import { SleepModule } from "../health/sleep/sleep.module";
import { ActivitiesModule } from "../activities/activities.module";
import { BodyModule } from "../health/body/body.module";

@Module({
  imports: [HeartRateModule, Spo2Module, StepsModule, SleepModule, ActivitiesModule, BodyModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
