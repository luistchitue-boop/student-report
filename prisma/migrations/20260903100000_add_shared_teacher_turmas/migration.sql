CREATE TABLE "TeacherTurma" (
    "teacherId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    CONSTRAINT "TeacherTurma_pkey" PRIMARY KEY ("teacherId", "turmaId")
);

CREATE INDEX "TeacherTurma_turmaId_idx" ON "TeacherTurma"("turmaId");
ALTER TABLE "TeacherTurma" ADD CONSTRAINT "TeacherTurma_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherTurma" ADD CONSTRAINT "TeacherTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "TeacherTurma" ("teacherId", "turmaId")
SELECT "coordinatorId", "id" FROM "Turma" WHERE "coordinatorId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "TeacherTurma" ("teacherId", "turmaId")
SELECT "teacherId", "turmaId" FROM "DireccaoTurma"
ON CONFLICT DO NOTHING;
