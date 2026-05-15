import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ProfileDto {
  gender?: string;
  dateOfBirth?: string;
  height?: number;
  weight?: number;
  restingHr?: number;
  maxHr?: number;
  walkingStepLength?: number;
  runningStrideLength?: number;
  vo2max?: number;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<ProfileDto> {
    const p = await this.prisma.profile.findUnique({ where: { userId } });
    if (!p) return {};
    return {
      gender:             p.gender ?? undefined,
      dateOfBirth:        p.dateOfBirth?.toISOString().slice(0, 10),
      height:             p.heightCm ?? undefined,
      weight:             p.weightKg ?? undefined,
      restingHr:          p.restingHr ?? undefined,
      maxHr:              p.maxHr ?? undefined,
      walkingStepLength:  p.walkingStepLengthCm ?? undefined,
      runningStrideLength: p.runningStrideLengthCm ?? undefined,
      vo2max:             p.vo2Max ?? undefined,
    };
  }

  async save(userId: string, dto: ProfileDto): Promise<{ ok: boolean }> {
    const data = {
      gender:               dto.gender,
      dateOfBirth:          dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      heightCm:             dto.height,
      weightKg:             dto.weight,
      restingHr:            dto.restingHr,
      maxHr:                dto.maxHr,
      walkingStepLengthCm:  dto.walkingStepLength,
      runningStrideLengthCm: dto.runningStrideLength,
      vo2Max:               dto.vo2max,
    };
    await this.prisma.profile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return { ok: true };
  }
}
