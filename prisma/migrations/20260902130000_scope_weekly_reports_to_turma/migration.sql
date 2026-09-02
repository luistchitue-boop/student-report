ALTER TABLE "WeeklyCoordinationReport" ADD COLUMN "turmaId" TEXT;

UPDATE "WeeklyCoordinationReport" report
SET "turmaId" = (
    SELECT "id" FROM "Turma"
    WHERE "coordinatorId" IN (SELECT "userId" FROM "Teacher" WHERE "id" = report."userId")
    ORDER BY "name"
    LIMIT 1
);

ALTER TABLE "WeeklyCoordinationReport" ALTER COLUMN "turmaId" SET NOT NULL;
DROP INDEX "WeeklyCoordinationReport_userId_weekStart_key";
CREATE INDEX "WeeklyCoordinationReport_turmaId_idx" ON "WeeklyCoordinationReport"("turmaId");
CREATE UNIQUE INDEX "WeeklyCoordinationReport_userId_turmaId_weekStart_key" ON "WeeklyCoordinationReport"("userId", "turmaId", "weekStart");
ALTER TABLE "WeeklyCoordinationReport" ADD CONSTRAINT "WeeklyCoordinationReport_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;