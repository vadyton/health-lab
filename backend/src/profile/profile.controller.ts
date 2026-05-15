import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import { ProfileService, ProfileDto } from "./profile.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as CU } from "../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("api/profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async get(@CurrentUser() user: CU) {
    return this.profileService.get(user.id);
  }

  @Put()
  async save(@CurrentUser() user: CU, @Body() dto: ProfileDto) {
    return this.profileService.save(user.id, dto);
  }
}
