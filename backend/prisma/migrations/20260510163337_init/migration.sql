-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeartRate" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "bpm" SMALLINT NOT NULL,

    CONSTRAINT "HeartRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spo2" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "value" SMALLINT NOT NULL,

    CONSTRAINT "Spo2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Step" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "steps" INTEGER NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,

    CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sleep" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "bedtime" TIMESTAMPTZ NOT NULL,
    "wakeUp" TIMESTAMPTZ NOT NULL,
    "durationMin" SMALLINT,
    "deepMin" SMALLINT,
    "lightMin" SMALLINT,
    "remMin" SMALLINT,
    "awakeMin" SMALLINT,
    "awakeCount" SMALLINT,
    "avgHr" SMALLINT,
    "minHr" SMALLINT,
    "maxHr" SMALLINT,
    "avgSpo2" SMALLINT,
    "minSpo2" SMALLINT,
    "score" SMALLINT,
    "avgBreath" DOUBLE PRECISION,
    "stages" JSONB,

    CONSTRAINT "Sleep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "externalSid" TEXT,
    "category" TEXT NOT NULL,
    "startTs" TIMESTAMPTZ NOT NULL,
    "endTs" TIMESTAMPTZ NOT NULL,
    "durationS" INTEGER,
    "calories" INTEGER,
    "avgHr" SMALLINT,
    "maxHr" SMALLINT,
    "minHr" SMALLINT,
    "distanceM" DOUBLE PRECISION,
    "trainLoad" INTEGER,
    "trainEffect" DOUBLE PRECISION,
    "trainLoadLevel" SMALLINT,
    "recoverTime" INTEGER,
    "vo2Max" DOUBLE PRECISION,
    "title" TEXT,
    "notes" TEXT,
    "extra" JSONB,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityHr" (
    "id" BIGSERIAL NOT NULL,
    "activityId" BIGINT NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "bpm" SMALLINT NOT NULL,

    CONSTRAINT "ActivityHr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stress" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "value" SMALLINT NOT NULL,

    CONSTRAINT "Stress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vitality" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Vitality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gender" TEXT,
    "dateOfBirth" DATE,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "restingHr" SMALLINT,
    "maxHr" SMALLINT,
    "walkingStepLengthCm" DOUBLE PRECISION,
    "runningStrideLengthCm" DOUBLE PRECISION,
    "vo2Max" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE INDEX "HeartRate_userId_ts_idx" ON "HeartRate"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "HeartRate_userId_ts_key" ON "HeartRate"("userId", "ts");

-- CreateIndex
CREATE INDEX "Spo2_userId_ts_idx" ON "Spo2"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Spo2_userId_ts_key" ON "Spo2"("userId", "ts");

-- CreateIndex
CREATE INDEX "Step_userId_ts_idx" ON "Step"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Step_userId_ts_key" ON "Step"("userId", "ts");

-- CreateIndex
CREATE INDEX "Sleep_userId_bedtime_idx" ON "Sleep"("userId", "bedtime");

-- CreateIndex
CREATE UNIQUE INDEX "Sleep_userId_bedtime_key" ON "Sleep"("userId", "bedtime");

-- CreateIndex
CREATE INDEX "Activity_userId_startTs_idx" ON "Activity"("userId", "startTs");

-- CreateIndex
CREATE INDEX "Activity_userId_category_idx" ON "Activity"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_startTs_key" ON "Activity"("userId", "startTs");

-- CreateIndex
CREATE INDEX "ActivityHr_activityId_ts_idx" ON "ActivityHr"("activityId", "ts");

-- CreateIndex
CREATE INDEX "Stress_userId_ts_idx" ON "Stress"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Stress_userId_ts_key" ON "Stress"("userId", "ts");

-- CreateIndex
CREATE INDEX "Vitality_userId_ts_idx" ON "Vitality"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Vitality_userId_ts_key" ON "Vitality"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- AddForeignKey
ALTER TABLE "HeartRate" ADD CONSTRAINT "HeartRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spo2" ADD CONSTRAINT "Spo2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sleep" ADD CONSTRAINT "Sleep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityHr" ADD CONSTRAINT "ActivityHr_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stress" ADD CONSTRAINT "Stress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vitality" ADD CONSTRAINT "Vitality_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
