BEGIN;

CREATE TABLE "School" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logoUrl" TEXT,
  "address" TEXT,
  "website" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolMembership" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'COORDENADOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);

-- Preserve the existing installation as its own tenant. This fixed ID makes
-- the backfill deterministic and does not modify or remove existing records.
INSERT INTO "School" ("id", "name", "logoUrl", "address", "website", "updatedAt")
VALUES (
  'legacy-neph-school',
  'Nova Escola Politécnica do Huambo',
  NULL,
  NULL,
  'https://www.neph.ao',
  CURRENT_TIMESTAMP
);

ALTER TABLE "Turma" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "ClosedWeeklyPeriod" ADD COLUMN "schoolId" TEXT;

UPDATE "Turma" SET "schoolId" = 'legacy-neph-school' WHERE "schoolId" IS NULL;
UPDATE "ActivityLog" SET "schoolId" = 'legacy-neph-school' WHERE "schoolId" IS NULL;
UPDATE "ClosedWeeklyPeriod" SET "schoolId" = 'legacy-neph-school' WHERE "schoolId" IS NULL;

ALTER TABLE "Turma" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ActivityLog" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "ClosedWeeklyPeriod" ALTER COLUMN "schoolId" SET NOT NULL;

-- Existing accounts retain their current teacher role within the legacy school.
-- Accounts without a Teacher profile receive the same coordinator fallback used
-- by the existing authentication callback.
INSERT INTO "SchoolMembership" ("id", "schoolId", "userId", "role", "createdAt")
SELECT
  'legacy-membership-' || md5("User"."id"),
  'legacy-neph-school',
  "User"."id",
  COALESCE("Teacher"."role", 'COORDENADOR'),
  CURRENT_TIMESTAMP
FROM "User"
LEFT JOIN "Teacher" ON "Teacher"."userId" = "User"."id";

CREATE UNIQUE INDEX "SchoolMembership_schoolId_userId_key"
  ON "SchoolMembership"("schoolId", "userId");
CREATE INDEX "SchoolMembership_userId_idx" ON "SchoolMembership"("userId");
CREATE INDEX "Turma_schoolId_idx" ON "Turma"("schoolId");
DROP INDEX IF EXISTS "Turma_code_key";
CREATE UNIQUE INDEX "Turma_schoolId_code_key" ON "Turma"("schoolId", "code");
CREATE INDEX "ActivityLog_schoolId_createdAt_idx" ON "ActivityLog"("schoolId", "createdAt");
CREATE INDEX "ClosedWeeklyPeriod_schoolId_weekStart_idx"
  ON "ClosedWeeklyPeriod"("schoolId", "weekStart");

-- Replace the database-wide weekly closure key with an equivalent key scoped
-- to a school. Existing rows remain intact and cannot conflict after backfill.
DROP INDEX IF EXISTS "ClosedWeeklyPeriod_weekStart_weekEnd_key";
CREATE UNIQUE INDEX "ClosedWeeklyPeriod_schoolId_weekStart_weekEnd_key"
  ON "ClosedWeeklyPeriod"("schoolId", "weekStart", "weekEnd");

ALTER TABLE "SchoolMembership"
  ADD CONSTRAINT "SchoolMembership_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolMembership"
  ADD CONSTRAINT "SchoolMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turma"
  ADD CONSTRAINT "Turma_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityLog"
  ADD CONSTRAINT "ActivityLog_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClosedWeeklyPeriod"
  ADD CONSTRAINT "ClosedWeeklyPeriod_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
