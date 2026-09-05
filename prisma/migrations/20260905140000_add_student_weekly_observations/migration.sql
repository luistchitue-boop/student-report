CREATE TABLE "StudentWeeklyObservation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "teacherObservation" TEXT NOT NULL,
    "behavior" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWeeklyObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentWeeklyObservation_studentId_weekStart_key" ON "StudentWeeklyObservation"("studentId", "weekStart");
CREATE INDEX "StudentWeeklyObservation_studentId_idx" ON "StudentWeeklyObservation"("studentId");

ALTER TABLE "StudentWeeklyObservation" ADD CONSTRAINT "StudentWeeklyObservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
