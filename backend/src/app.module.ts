import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { HeartRateModule } from "./health/heart-rate/heart-rate.module";
import { Spo2Module } from "./health/spo2/spo2.module";
import { StepsModule } from "./health/steps/steps.module";
import { SleepModule } from "./health/sleep/sleep.module";
import { ActivitiesModule } from "./activities/activities.module";
import { ImportModule } from "./import/import.module";
import { ProfileModule } from "./profile/profile.module";
import { AuthModule } from "./auth/auth.module";
import { BodyModule } from "./health/body/body.module";
import { DataManagementModule } from "./data-management/data-management.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../.env", ".env"],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HeartRateModule,
    Spo2Module,
    StepsModule,
    SleepModule,
    ActivitiesModule,
    ImportModule,
    ProfileModule,
    BodyModule,
    DataManagementModule,
  ],
})
export class AppModule {}
