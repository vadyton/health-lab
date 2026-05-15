import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { HeartRateService } from "./heart-rate.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { CurrentUser as CU } from "../../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/heart-rate")
export class HeartRateController {
  constructor(private readonly heartRateService: HeartRateService) {}

  @Get()
  async get(@CurrentUser() user: CU, @Query("date") date?: string, @Query("range") range = "day") {
    const today = new Date().toISOString().slice(0, 10);
    return this.heartRateService.getForRange(user.id, date ?? today, range as any);
  }
}
