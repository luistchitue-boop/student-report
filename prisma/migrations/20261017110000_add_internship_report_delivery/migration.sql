CREATE TABLE "InternshipReportDelivery" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "parentId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientContact" TEXT NOT NULL,
    "channel" "ReportDeliveryChannel" NOT NULL,
    "providerEmailId" TEXT,
    "providerMessageSid" TEXT,
    "status" "ReportDeliveryStatus" NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipReportDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternshipReportDelivery_providerEmailId_key" ON "InternshipReportDelivery"("providerEmailId");
CREATE UNIQUE INDEX "InternshipReportDelivery_providerMessageSid_key" ON "InternshipReportDelivery"("providerMessageSid");
CREATE INDEX "InternshipReportDelivery_reportId_attemptedAt_idx" ON "InternshipReportDelivery"("reportId", "attemptedAt");
CREATE INDEX "InternshipReportDelivery_parentId_idx" ON "InternshipReportDelivery"("parentId");

ALTER TABLE "InternshipReportDelivery" ADD CONSTRAINT "InternshipReportDelivery_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InternshipPerformanceReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternshipReportDelivery" ADD CONSTRAINT "InternshipReportDelivery_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
