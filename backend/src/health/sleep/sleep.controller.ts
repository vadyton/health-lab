import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { SleepService } from "./sleep.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { CurrentUser as CU } from "../../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/sleep")
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  @Get("summary")
  async getSummary(@CurrentUser() user: CU) {
    return this.sleepService.getSummary(user.id);
  }

  @Get()
  async get(@CurrentUser() user: CU, @Query("limit") limit = "60", @Query("offset") offset = "0") {
    return this.sleepService.getList(user.id, Number(limit), Number(offset));
  }

  @Get(":id")
  async getOne(@CurrentUser() user: CU, @Param("id") id: string) {
    return this.sleepService.getOne(user.id, id);
  }
}
