-- CreateTable
CREATE TABLE "ClosedWeeklyPeriod" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ClosedWeeklyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosedWeeklyPeriod_weekStart_weekEnd_key" ON "ClosedWeeklyPeriod"("weekStart", "weekEnd");

-- CreateIndex
CREATE INDEX "ClosedWeeklyPeriod_weekStart_idx" ON "ClosedWeeklyPeriod"("weekStart");

-- AddForeignKey
ALTER TABLE "ClosedWeeklyPeriod" ADD CONSTRAINT "ClosedWeeklyPeriod_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE CASCADE;
