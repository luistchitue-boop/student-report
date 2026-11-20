CREATE TABLE "PresentationAccess" (
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentationAccess_pkey" PRIMARY KEY ("schoolId", "userId")
);

CREATE INDEX "PresentationAccess_userId_idx" ON "PresentationAccess"("userId");

ALTER TABLE "PresentationAccess"
ADD CONSTRAINT "PresentationAccess_schoolId_userId_fkey"
FOREIGN KEY ("schoolId", "userId") REFERENCES "SchoolMembership"("schoolId", "userId")
ON DELETE CASCADE ON UPDATE CASCADE;
