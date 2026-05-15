import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { StepsService } from "./steps.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { CurrentUser as CU } from "../../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/steps")
export class StepsController {
  constructor(private readonly stepsService: StepsService) {}

  @Get()
  async get(@CurrentUser() user: CU, @Query("date") date?: string, @Query("range") range = "week") {
    const today = new Date().toISOString().slice(0, 10);
    return this.stepsService.getForRange(user.id, date ?? today, range as any);
  }
}
