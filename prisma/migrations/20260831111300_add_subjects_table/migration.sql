-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subject_turmaId_idx" ON "Subject"("turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_turmaId_name_key" ON "Subject"("turmaId", "name");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
