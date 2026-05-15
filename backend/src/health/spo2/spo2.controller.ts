import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Spo2Service } from "./spo2.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { CurrentUser as CU } from "../../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/spo2")
export class Spo2Controller {
  constructor(private readonly spo2Service: Spo2Service) {}

  @Get()
  async get(@CurrentUser() user: CU, @Query("date") date?: string, @Query("range") range = "day") {
    const today = new Date().toISOString().slice(0, 10);
    return this.spo2Service.getForRange(user.id, date ?? today, range as any);
  }
}
