-- CreateTable
CREATE TABLE "WeeklyCoordinationReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyCoordinationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyCoordinationReport_weekStart_idx" ON "WeeklyCoordinationReport"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCoordinationReport_userId_weekStart_key" ON "WeeklyCoordinationReport"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeeklyCoordinationReport" ADD CONSTRAINT "WeeklyCoordinationReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;