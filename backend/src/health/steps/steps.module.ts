import { Module } from "@nestjs/common";
import { StepsService } from "./steps.service";
import { StepsController } from "./steps.controller";
import { UsersModule } from "../../users/users.module";

@Module({
  imports: [UsersModule],
  providers: [StepsService],
  controllers: [StepsController],
  exports: [StepsService],
})
export class StepsModule {}
