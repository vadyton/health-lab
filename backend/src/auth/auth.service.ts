import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";

export interface JwtPayload { sub: string; username: string; }

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(username: string, password: string) {
    if (!username || username.length < 3) throw new BadRequestException("Имя пользователя минимум 3 символа");
    if (!password || password.length < 6) throw new BadRequestException("Пароль минимум 6 символов");

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing?.passwordHash) throw new ConflictException("Пользователь уже существует");

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { username, name: username, passwordHash: hash },
    });

    return this.issueToken(user);
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user?.passwordHash) throw new UnauthorizedException("Неверный логин или пароль");
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Неверный логин или пароль");
    return this.issueToken(user);
  }

  private issueToken(user: { id: string; username: string | null }) {
    const payload: JwtPayload = { sub: user.id, username: user.username ?? "" };
    return {
      access_token: this.jwtService.sign(payload),
      userId: user.id,
      username: user.username ?? "",
    };
  }
}
