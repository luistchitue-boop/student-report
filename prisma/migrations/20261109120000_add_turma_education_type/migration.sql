CREATE TYPE "TurmaEducationType" AS ENUM ('ENSINO_GERAL', 'ENSINO_TECNICO');

ALTER TABLE "Turma" ADD COLUMN "educationType" "TurmaEducationType";
