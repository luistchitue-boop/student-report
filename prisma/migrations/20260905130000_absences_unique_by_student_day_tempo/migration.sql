WITH ranked_absences AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "studentId", dia, tempo
      ORDER BY "createdAt" ASC, id ASC
    ) AS row_number
  FROM "Absence"
)
DELETE FROM "Absence"
WHERE id IN (SELECT id FROM ranked_absences WHERE row_number > 1);

DROP INDEX "Absence_studentId_subject_dia_key";
CREATE UNIQUE INDEX "Absence_studentId_dia_tempo_key" ON "Absence" ("studentId", dia, tempo);