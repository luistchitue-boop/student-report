CREATE TYPE "ReportDeliveryStatus" AS ENUM ('SENT', 'FAILED');

CREATE TABLE "ReportDelivery" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "reportUrl" TEXT,
    "status" "ReportDeliveryStatus" NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportDelivery_studentId_periodStart_recipientEmail_key" ON "ReportDelivery"("studentId", "periodStart", "recipientEmail");
CREATE INDEX "ReportDelivery_turmaId_periodStart_status_idx" ON "ReportDelivery"("turmaId", "periodStart", "status");

ALTER TABLE "ReportDelivery" ADD CONSTRAINT "ReportDelivery_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportDelivery" ADD CONSTRAINT "ReportDelivery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
