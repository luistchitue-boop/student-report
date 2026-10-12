ALTER TYPE "ReportDeliveryStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "ReportDeliveryStatus" ADD VALUE 'BOUNCED';
ALTER TYPE "ReportDeliveryStatus" ADD VALUE 'DELAYED';

ALTER TABLE "ReportDelivery" ADD COLUMN "providerEmailId" TEXT;
CREATE UNIQUE INDEX "ReportDelivery_providerEmailId_key" ON "ReportDelivery"("providerEmailId");
