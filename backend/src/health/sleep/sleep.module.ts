import { Module } from "@nestjs/common";
import { SleepService } from "./sleep.service";
import { SleepController } from "./sleep.controller";
import { UsersModule } from "../../users/users.module";

@Module({
  imports: [UsersModule],
  providers: [SleepService],
  controllers: [SleepController],
  exports: [SleepService],
})
export class SleepModule {}
