import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>("DATABASE_URL");
    super({
      adapter: new PrismaPg(new pg.Pool({
        connectionString: url,
        max: 3,
        idleTimeoutMillis: 30_000,      // drop idle connections after 30s (before Neon kills them at ~5min)
        connectionTimeoutMillis: 10_000, // fail fast instead of hanging indefinitely
      })),
    });
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
