/*
  Warnings:

  - A unique constraint covering the columns `[studentId,subject,dia]` on the table `Absence` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Absence_studentId_subject_dia_key" ON "Absence"("studentId", "subject", "dia");
