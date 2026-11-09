CREATE TYPE "GradeAssessmentType" AS ENUM ('AC2', 'NPP', 'NPT');
CREATE TYPE "Trimester" AS ENUM ('I', 'II', 'III');

ALTER TABLE "Grade"
  ADD COLUMN "assessmentType" "GradeAssessmentType",
  ADD COLUMN "trimester" "Trimester";

ALTER TABLE "Grade"
  ADD CONSTRAINT "Grade_assessmentType_trimester_consistent"
  CHECK (("assessmentType" IS NULL AND "trimester" IS NULL) OR ("assessmentType" IS NOT NULL AND "trimester" IS NOT NULL));
