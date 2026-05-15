import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";

class AuthDto {
  username!: string;
  password!: string;
}

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: AuthDto) {
    return this.authService.register(dto.username, dto.password);
  }

  @Public()
  @Post("login")
  login(@Body() dto: AuthDto) {
    return this.authService.login(dto.username, dto.password);
  }
}
