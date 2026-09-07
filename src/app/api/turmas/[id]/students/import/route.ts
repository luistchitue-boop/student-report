import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return Response.json({ error: "Apenas administradores podem importar alunos." }, { status: 403 });

  try {
    const { id: turmaId } = await params;
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { id: true } });
    if (!turma) return Response.json({ error: "Turma não encontrada." }, { status: 404 });

    const formData = await request.formData();
    const fileValue = formData.get("file");
    if (!fileValue || typeof fileValue !== "object" || typeof (fileValue as File).arrayBuffer !== "function") {
      return Response.json({ error: "Selecione um ficheiro .xlsx." }, { status: 400 });
    }

    const file = fileValue as File;
    if (!file.name.toLowerCase().endsWith(".xlsx")) return Response.json({ error: "O ficheiro deve estar no formato .xlsx." }, { status: 400 });

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return Response.json({ error: "A folha de cálculo está vazia." }, { status: 400 });

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!rows.length) return Response.json({ error: "A folha de cálculo não contém linhas de dados." }, { status: 400 });

    const students = new Map<string, { name: string; parents: Map<string, { name: string; phone: string; email: string }> }>();
    let invalid = 0;
    rows.forEach((row) => {
      const values = new Map(Object.entries(row).map(([key, value]) => [normalizeKey(key), String(value ?? "").trim()]));
      const studentName = normalizeName(values.get("aluno") ?? "");
      const parentName = normalizeName(values.get("nomedoencarregado") ?? "");
      const phone = values.get("telefone") ?? "";
      const email = values.get("email") ?? "";
      if (!studentName || !parentName || !phone) {
        invalid += 1;
        return;
      }

      const studentKey = normalizeKey(studentName);
      const student = students.get(studentKey) ?? { name: studentName, parents: new Map() };
      const parentKey = `${normalizeKey(parentName)}|${phone}|${email.toLowerCase()}`;
      student.parents.set(parentKey, { name: parentName, phone, email });
      students.set(studentKey, student);
    });

    if (!students.size) return Response.json({ error: "Não existem linhas válidas para importar.", invalid }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.student.findMany({ where: { turmaId }, select: { name: true } });
      const existingNames = new Set(existing.map((student) => normalizeKey(student.name)));
      let imported = 0;
      let skipped = 0;

      for (const [studentKey, student] of students) {
        if (existingNames.has(studentKey)) {
          skipped += 1;
          continue;
        }
        await transaction.student.create({
          data: { turmaId, name: student.name, parents: { create: Array.from(student.parents.values()) } },
        });
        existingNames.add(studentKey);
        imported += 1;
      }
      return { imported, skipped };
    }, { maxWait: 10000, timeout: 60000 });

    return Response.json({ ...result, invalid });
  } catch (error) {
    console.error("Student spreadsheet import error:", error);
    return Response.json({ error: "Não foi possível importar o ficheiro." }, { status: 500 });
  }
}