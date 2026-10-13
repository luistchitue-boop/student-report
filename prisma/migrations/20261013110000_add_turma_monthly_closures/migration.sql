CREATE TABLE "ClosedTurmaMonthlyPeriod" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ClosedTurmaMonthlyPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClosedTurmaMonthlyPeriod_turmaId_periodStart_key" ON "ClosedTurmaMonthlyPeriod"("turmaId", "periodStart");
CREATE INDEX "ClosedTurmaMonthlyPeriod_turmaId_periodStart_periodEnd_idx" ON "ClosedTurmaMonthlyPeriod"("turmaId", "periodStart", "periodEnd");

ALTER TABLE "ClosedTurmaMonthlyPeriod" ADD CONSTRAINT "ClosedTurmaMonthlyPeriod_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClosedTurmaMonthlyPeriod" ADD CONSTRAINT "ClosedTurmaMonthlyPeriod_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
