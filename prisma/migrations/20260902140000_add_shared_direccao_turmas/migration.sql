CREATE TABLE "DireccaoTurma" (
    "teacherId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    CONSTRAINT "DireccaoTurma_pkey" PRIMARY KEY ("teacherId", "turmaId")
);

CREATE INDEX "DireccaoTurma_turmaId_idx" ON "DireccaoTurma"("turmaId");
ALTER TABLE "DireccaoTurma" ADD CONSTRAINT "DireccaoTurma_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DireccaoTurma" ADD CONSTRAINT "DireccaoTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DireccaoTurma" ("teacherId", "turmaId")
SELECT t.id, turma.id
FROM "Teacher" t
JOIN "Turma" turma ON turma."coordinatorId" = t.id
WHERE t.role = 'DIRECCAO'
ON CONFLICT DO NOTHING;

UPDATE "Turma" turma
SET "coordinatorId" = NULL
FROM "Teacher" t
WHERE turma."coordinatorId" = t.id AND t.role = 'DIRECCAO';