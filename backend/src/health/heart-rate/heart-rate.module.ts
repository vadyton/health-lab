import { Module } from "@nestjs/common";
import { HeartRateService } from "./heart-rate.service";
import { HeartRateController } from "./heart-rate.controller";
import { UsersModule } from "../../users/users.module";

@Module({
  imports: [UsersModule],
  providers: [HeartRateService],
  controllers: [HeartRateController],
  exports: [HeartRateService],
})
export class HeartRateModule {}
