import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { BodyService } from "./body.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { CurrentUser as CU } from "../../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/body")
export class BodyController {
  constructor(private readonly bodyService: BodyService) {}

  @Get()
  async get(
    @CurrentUser() user: CU,
    @Query("date") date?: string,
    @Query("range") range = "year",
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.bodyService.getForRange(user.id, date ?? today, range as any);
  }

  @Get("latest")
  async latest(@CurrentUser() user: CU) {
    return this.bodyService.getLatest(user.id);
  }
}
