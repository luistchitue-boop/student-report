ALTER TABLE "School"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reportsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "RootActivityLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RootActivityLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RootActivityLog_schoolId_createdAt_idx" ON "RootActivityLog"("schoolId", "createdAt");
