BEGIN;

CREATE TABLE "SchoolCreationCodeRedemption" (
  "codeHash" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "redeemedByUserId" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolCreationCodeRedemption_pkey" PRIMARY KEY ("codeHash")
);

CREATE UNIQUE INDEX "SchoolCreationCodeRedemption_schoolId_key"
  ON "SchoolCreationCodeRedemption"("schoolId");
CREATE INDEX "SchoolCreationCodeRedemption_redeemedByUserId_idx"
  ON "SchoolCreationCodeRedemption"("redeemedByUserId");
CREATE INDEX "SchoolCreationCodeRedemption_redeemedAt_idx"
  ON "SchoolCreationCodeRedemption"("redeemedAt");

ALTER TABLE "SchoolCreationCodeRedemption"
  ADD CONSTRAINT "SchoolCreationCodeRedemption_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
