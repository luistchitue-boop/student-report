import * as XLSX from "xlsx";

type EducationType = "ENSINO_GERAL" | "ENSINO_TECNICO" | null;
type Trimester = "I" | "II" | "III" | "";

type ImportOptions = {
  educationType: EducationType;
  assessmentType: string;
  trimester: Trimester;
  gradeScale: number;
  roster: Array<{ id: string; name: string }>;
};

export type ImportedGrade = { studentId: string; value: number };

export type MiniPautaImportResult = {
  grades: ImportedGrade[];
  source: string;
  unmatched: number;
  invalid: number;
  ambiguous: number;
};

export class MiniPautaImportValidationError extends Error {
  constructor(
    readonly selectedTrimester: string,
    readonly latestPopulatedTrimester: string | null,
    readonly populatedStudentCount: number,
    readonly sheetName: string,
  ) {
    super("O trimestre selecionado para importar NPP não corresponde ao trimestre mais recente preenchido no ficheiro.");
    this.name = "MiniPautaImportValidationError";
  }
}

type SheetRows = unknown[][];
type StudentRow = { name: string; values: unknown[] };

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeStudentName(value: string) {
  return value.toLocaleLowerCase().replace(/\s/g, "");
}

function parseGrade(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  const decimal = trimmed.includes(",") && !trimmed.includes(".")
    ? trimmed.replace(",", ".")
    : trimmed;
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(decimal)) return null;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

function isGradeInScale(value: unknown, gradeScale: number) {
  const parsed = parseGrade(value);
  return parsed !== null && parsed >= 0 && parsed <= gradeScale;
}

function getRows(sheet: XLSX.WorkSheet): SheetRows {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: true }) as SheetRows;
}

function findNameHeader(rows: SheetRows) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const columnIndex = rows[rowIndex].findIndex((cell) => ["nome", "nomedoaluno", "nomecompleto"].includes(normalize(cell)));
    if (columnIndex >= 0) return { rowIndex, columnIndex };
  }
  return null;
}

function getStudentRows(rows: SheetRows, headerRow: number, nameColumn: number): StudentRow[] {
  return rows.slice(headerRow + 1).flatMap((row) => {
    const name = row[nameColumn];
    return typeof name === "string" && name.trim() ? [{ name: name.trim(), values: row }] : [];
  });
}

function getHeaderColumns(rows: SheetRows, headerRow: number) {
  const columns = new Map<string, number[]>();
  rows[headerRow].forEach((value, index) => {
    const header = normalize(value);
    if (!header) return;
    columns.set(header, [...(columns.get(header) ?? []), index]);
  });
  return columns;
}

function findColumn(columns: Map<string, number[]>, name: string) {
  return columns.get(normalize(name))?.[0];
}

function mapGrades(
  rows: StudentRow[],
  valueForRow: (row: StudentRow) => number | null,
  options: ImportOptions,
  source: string,
): MiniPautaImportResult {
  const rosterByName = new Map<string, string[]>();
  options.roster.forEach((student) => {
    const key = normalizeStudentName(student.name);
    rosterByName.set(key, [...(rosterByName.get(key) ?? []), student.id]);
  });

  const grades = new Map<string, number>();
  const sourceNames = new Set<string>();
  let unmatched = 0;
  let invalid = 0;
  let ambiguous = 0;

  for (const row of rows) {
    const key = normalizeStudentName(row.name);
    if (sourceNames.has(key)) {
      ambiguous += 1;
      continue;
    }
    sourceNames.add(key);

    const studentIds = rosterByName.get(key) ?? [];
    if (studentIds.length !== 1) {
      if (studentIds.length > 1) ambiguous += 1;
      else unmatched += 1;
      continue;
    }

    const value = valueForRow(row);
    if (value === null || value < 0 || value > options.gradeScale) {
      invalid += 1;
      continue;
    }
    grades.set(studentIds[0], value);
  }

  return { grades: [...grades].map(([studentId, value]) => ({ studentId, value })), source, unmatched, invalid, ambiguous };
}

function getGeneralImport(
  workbook: XLSX.WorkBook,
  options: ImportOptions,
): MiniPautaImportResult {
  const sheetName = workbook.SheetNames.find((name) => normalize(name).includes("mapamac")) ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error("Não foi encontrada uma folha de notas no ficheiro.");

  const rows = getRows(sheet);
  const nameHeader = findNameHeader(rows);
  if (!nameHeader) throw new Error("Não foi encontrada a coluna com os nomes dos alunos.");
  const columns = getHeaderColumns(rows, nameHeader.rowIndex);
  const studentRows = getStudentRows(rows, nameHeader.rowIndex, nameHeader.columnIndex);

  let sourceColumn: number | undefined;
  let sourceName = "";
  if (!options.assessmentType) {
    for (const candidate of ["RT1", "TP1", "PA1"]) {
      const index = findColumn(columns, candidate);
      if (index !== undefined && studentRows.some((row) => isGradeInScale(row.values[index], options.gradeScale))) {
        sourceColumn = index;
        sourceName = candidate;
        break;
      }
    }
  } else {
    const requestedColumn = options.assessmentType === "AC2" ? "AC2" : options.assessmentType;
    sourceColumn = findColumn(columns, requestedColumn);
    sourceName = requestedColumn;
  }

  if (sourceColumn === undefined) {
    throw new Error(options.assessmentType
      ? `A coluna ${options.assessmentType} não existe no modelo de Ensino Geral.`
      : "Não foram encontradas notas numéricas nas colunas RT1, TP1 ou PA1.");
  }

  return mapGrades(studentRows, (row) => parseGrade(row.values[sourceColumn!]), options, sourceName);
}

function getTechnicalSections(rows: SheetRows, headerRow: number, headerColumns: Map<string, number[]>) {
  const quarterStarts = new Map<"I" | "II" | "III", number>();
  rows.slice(0, headerRow).forEach((row) => {
    row.forEach((value, columnIndex) => {
      const header = normalize(value);
      if (header === "1trimestre") quarterStarts.set("I", columnIndex);
      if (header === "2trimestre") quarterStarts.set("II", columnIndex);
      if (header === "3trimestre") quarterStarts.set("III", columnIndex);
    });
  });

  const orderedStarts = [...quarterStarts.entries()].sort((a, b) => a[1] - b[1]);
  return new Map([...quarterStarts.entries()].map(([trimester, start]) => {
    const nextStart = orderedStarts.find((entry) => entry[1] > start)?.[1] ?? Number.POSITIVE_INFINITY;
    const fields = new Map<string, number>();
    for (const [header, indexes] of headerColumns) {
      const index = indexes.find((columnIndex) => columnIndex >= start && columnIndex < nextStart);
      if (index !== undefined) fields.set(header, index);
    }
    return [trimester, fields];
  }));
}

function getTechnicalImport(workbook: XLSX.WorkBook, options: ImportOptions): MiniPautaImportResult {
  const sheetName = workbook.SheetNames[1];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error("Não foi encontrada a segunda folha de notas do modelo de Ensino Técnico.");

  const rows = getRows(sheet);
  const nameHeader = findNameHeader(rows);
  if (!nameHeader) throw new Error("A segunda folha não contém uma coluna com os nomes dos alunos.");
  const gradeHeaderRow = nameHeader.rowIndex + 1;
  const headerColumns = getHeaderColumns(rows, gradeHeaderRow);
  const sections = getTechnicalSections(rows, gradeHeaderRow, headerColumns);
  const studentRows = getStudentRows(rows, gradeHeaderRow, nameHeader.columnIndex);

  if (options.assessmentType === "NPP") {
    let latestPopulatedTrimester: "I" | "II" | "III" | null = null;
    let populatedStudentCount = 0;
    for (const candidate of ["III", "II", "I"] as const) {
      const fields = sections.get(candidate);
      const gradeColumns = ["ac1", "ac2", "npp", "npt"]
        .map((field) => fields?.get(field))
        .filter((column): column is number => column !== undefined);
      const studentsWithGrades = studentRows.filter((row) =>
        gradeColumns.some((column) => isGradeInScale(row.values[column], options.gradeScale)),
      ).length;
      if (studentsWithGrades) {
        latestPopulatedTrimester = candidate;
        populatedStudentCount = studentsWithGrades;
        break;
      }
    }

    if (options.trimester !== latestPopulatedTrimester) {
      throw new MiniPautaImportValidationError(
        options.trimester || "não selecionado",
        latestPopulatedTrimester,
        populatedStudentCount,
        sheetName,
      );
    }
  }

  if (!options.assessmentType) {
    let selectedTrimester: "I" | "II" | "III" | undefined;
    let selectedColumns: Map<string, number> | undefined;
    for (const candidate of ["III", "II", "I"] as const) {
      const fields = sections.get(candidate);
      const ac1 = fields?.get("ac1");
      const ac2 = fields?.get("ac2");
      if (ac1 === undefined && ac2 === undefined) continue;
      if (studentRows.some((row) => (ac1 !== undefined && isGradeInScale(row.values[ac1], options.gradeScale)) || (ac2 !== undefined && isGradeInScale(row.values[ac2], options.gradeScale)))) {
        selectedTrimester = candidate;
        selectedColumns = fields;
        break;
      }
    }

    if (!selectedTrimester || !selectedColumns) {
      throw new Error("Não foram encontradas notas AC1/AC2 numéricas em nenhum trimestre da segunda folha.");
    }

    const ac1 = selectedColumns.get("ac1");
    const ac2 = selectedColumns.get("ac2");
    const source = `AC1/AC2 · ${selectedTrimester} trimestre`;
    return mapGrades(studentRows, (row) => {
      const first = ac1 === undefined ? null : parseGrade(row.values[ac1]);
      const second = ac2 === undefined ? null : parseGrade(row.values[ac2]);
      if (first === null) return second;
      if (second === null) return first;
      return Number(((first + second) / 2).toFixed(2));
    }, options, source);
  }

  const trimester = options.trimester as "I" | "II" | "III";
  const fields = sections.get(trimester);
  const requested = options.assessmentType === "AC2" ? "NPP" : options.assessmentType;
  const sourceColumn = fields?.get(normalize(requested));
  if (!fields || sourceColumn === undefined) {
    throw new Error(`A coluna ${requested} não existe no ${trimester} trimestre da segunda folha.`);
  }

  return mapGrades(studentRows, (row) => parseGrade(row.values[sourceColumn]), options, `${requested} · ${trimester} trimestre`);
}

export function importMiniPautaGrades(data: ArrayBuffer, options: ImportOptions): MiniPautaImportResult {
  const workbook = XLSX.read(data, { type: "array", cellDates: false });
  if (!workbook.SheetNames.length) throw new Error("O ficheiro não contém folhas de cálculo.");
  if (options.educationType === "ENSINO_TECNICO") return getTechnicalImport(workbook, options);
  if (options.educationType === "ENSINO_GERAL") return getGeneralImport(workbook, options);
  throw new Error("O tipo de ensino desta turma não está configurado.");
}