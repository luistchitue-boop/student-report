CREATE TYPE "ReportDeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP');

ALTER TABLE "ReportDelivery" ADD COLUMN "channel" "ReportDeliveryChannel" NOT NULL DEFAULT 'EMAIL';

DROP INDEX "ReportDelivery_studentId_periodStart_recipientEmail_key";
CREATE UNIQUE INDEX "ReportDelivery_studentId_periodStart_recipientEmail_channel_key" ON "ReportDelivery"("studentId", "periodStart", "recipientEmail", "channel");
DROP INDEX "ReportDelivery_turmaId_periodStart_status_idx";
CREATE INDEX "ReportDelivery_turmaId_periodStart_channel_status_idx" ON "ReportDelivery"("turmaId", "periodStart", "channel", "status");
