CREATE TABLE "LessonPlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turmaId" TEXT,
    "title" TEXT NOT NULL,
    "lessonNumber" TEXT,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "lessonDetails" TEXT NOT NULL,
    "resourceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PresentationResource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresentationResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonPlanFile" (
    "lessonPlanId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonPlanFile_pkey" PRIMARY KEY ("lessonPlanId", "resourceId")
);

CREATE UNIQUE INDEX "PresentationResource_pathname_key" ON "PresentationResource"("pathname");
CREATE INDEX "LessonPlan_schoolId_userId_updatedAt_idx" ON "LessonPlan"("schoolId", "userId", "updatedAt");
CREATE INDEX "LessonPlan_turmaId_idx" ON "LessonPlan"("turmaId");
CREATE INDEX "PresentationResource_schoolId_userId_createdAt_idx" ON "PresentationResource"("schoolId", "userId", "createdAt");
CREATE INDEX "LessonPlanFile_resourceId_idx" ON "LessonPlanFile"("resourceId");

ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonPlan" ADD CONSTRAINT "LessonPlan_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PresentationResource" ADD CONSTRAINT "PresentationResource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentationResource" ADD CONSTRAINT "PresentationResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonPlanFile" ADD CONSTRAINT "LessonPlanFile_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonPlanFile" ADD CONSTRAINT "LessonPlanFile_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "PresentationResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
