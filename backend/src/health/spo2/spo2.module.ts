import { Module } from "@nestjs/common";
import { Spo2Service } from "./spo2.service";
import { Spo2Controller } from "./spo2.controller";
import { UsersModule } from "../../users/users.module";

@Module({
  imports: [UsersModule],
  providers: [Spo2Service],
  controllers: [Spo2Controller],
  exports: [Spo2Service],
})
export class Spo2Module {}
