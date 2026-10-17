ALTER TABLE "Turma" ADD COLUMN "isInternship" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "InternshipStudentAssignment" (
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternshipStudentAssignment_pkey" PRIMARY KEY ("teacherId", "studentId")
);

CREATE TABLE "InternshipPerformanceReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT,
    "position" TEXT,
    "performanceRating" INTEGER NOT NULL,
    "strengths" TEXT NOT NULL,
    "improvementAreas" TEXT NOT NULL,
    "comments" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipPerformanceReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternshipStudentAssignment_studentId_idx" ON "InternshipStudentAssignment"("studentId");
CREATE UNIQUE INDEX "InternshipPerformanceReport_studentId_teacherId_periodStart_key" ON "InternshipPerformanceReport"("studentId", "teacherId", "periodStart");
CREATE INDEX "InternshipPerformanceReport_studentId_periodStart_idx" ON "InternshipPerformanceReport"("studentId", "periodStart");

ALTER TABLE "InternshipStudentAssignment" ADD CONSTRAINT "InternshipStudentAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternshipStudentAssignment" ADD CONSTRAINT "InternshipStudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternshipPerformanceReport" ADD CONSTRAINT "InternshipPerformanceReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternshipPerformanceReport" ADD CONSTRAINT "InternshipPerformanceReport_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
