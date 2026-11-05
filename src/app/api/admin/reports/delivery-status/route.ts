import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { isSendableEmailAddress } from "@/lib/email-address";
import { formatPeriodDate, type MonthlyPeriod } from "@/lib/weekly-coordination";

declare global {
  var prismaAdminDeliveryStatus: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminDeliveryStatus ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prismaAdminDeliveryStatus = prisma;

type DeliveryStatusIssue = {
  id: string;
  turmaId: string;
  studentId: string;
  turmaName: string;
  studentName: string;
  parents: Array<{ id: string; name: string; email: string; phone: string }>;
  parentId: string | null;
  recipientName: string | null;
  recipientEmail: string;
  status: "FAILED" | "BOUNCED" | "DELAYED" | "NOT_SENT";
  error: string | null;
  attemptedAt: string | null;
};

function parseMonthlyPeriod(periodKey: string): MonthlyPeriod | null {
  const [startKey, endKey, ...extra] = periodKey.split("|");
  if (extra.length || !/^\d{4}-\d{2}-\d{2}$/.test(startKey ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(endKey ?? "")) return null;
  const [year, month, day] = startKey.split("-").map(Number);
  const [endYear, endMonth, endDay] = endKey.split("-").map(Number);
  const start = new Date(year, month - 1, day, 12);
  const end = new Date(endYear, endMonth - 1, endDay, 12);
  const lastDay = new Date(year, month, 0, 12).getDate();
  if (formatPeriodDate(start) !== startKey || formatPeriodDate(end) !== endKey || day !== 1 || endYear !== year || endMonth !== month || endDay !== lastDay) return null;
  return { type: "MONTHLY", start, end, key: periodKey };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  const period = parseMonthlyPeriod(new URL(request.url).searchParams.get("periodKey") ?? "");
  if (!period || period.start > new Date()) {
    return NextResponse.json({ error: "Selecione um período mensal válido." }, { status: 400 });
  }

  const [turmas, activeStudents, deliveries] = await Promise.all([
    prisma.turma.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.student.findMany({ where: { active: true }, select: { id: true, name: true, turmaId: true, parents: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, phone: true } } } }),
    prisma.reportDelivery.findMany({
      where: { periodStart: period.start, channel: "EMAIL" },
      select: { id: true, turmaId: true, studentId: true, recipientName: true, recipientEmail: true, status: true, error: true, attemptedAt: true, student: { select: { name: true, parents: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, phone: true } } } }, turma: { select: { name: true } } },
    }),
  ]);

  const countsByTurma = new Map<string, { activeStudentIds: Set<string>; deliveredStudentIds: Set<string>; failed: number; bounced: number; delayed: number }>();
  for (const turma of turmas) countsByTurma.set(turma.id, { activeStudentIds: new Set(), deliveredStudentIds: new Set(), failed: 0, bounced: 0, delayed: 0 });
  for (const student of activeStudents) countsByTurma.get(student.turmaId)?.activeStudentIds.add(student.id);
  for (const delivery of deliveries) {
    const counts = countsByTurma.get(delivery.turmaId);
    if (!counts) continue;
    if (delivery.status === "DELIVERED") counts.deliveredStudentIds.add(delivery.studentId);
    if (delivery.status === "FAILED") counts.failed += 1;
    if (delivery.status === "BOUNCED") counts.bounced += 1;
    if (delivery.status === "DELAYED") counts.delayed += 1;
  }

  const summary = turmas.map((turma) => {
    const counts = countsByTurma.get(turma.id)!;
    const studentCount = counts.activeStudentIds.size;
    const deliveredCount = [...counts.deliveredStudentIds].filter((studentId) => counts.activeStudentIds.has(studentId)).length;
    return {
      id: turma.id,
      name: turma.name,
      studentCount,
      deliveredCount,
      percentage: studentCount ? Math.round((deliveredCount / studentCount) * 100) : 0,
      failedCount: counts.failed,
      bouncedCount: counts.bounced,
      delayedCount: counts.delayed,
    };
  });

  const issues: DeliveryStatusIssue[] = deliveries
    .filter((delivery): delivery is typeof delivery & { status: "FAILED" | "BOUNCED" | "DELAYED" } => delivery.status === "FAILED" || delivery.status === "BOUNCED" || delivery.status === "DELAYED")
    .filter((delivery) => !delivery.student.parents.some((parent) =>
      parent.name.trim().toLowerCase() === delivery.recipientName?.trim().toLowerCase()
      && isSendableEmailAddress(parent.email)
      && parent.email.trim().toLowerCase() !== delivery.recipientEmail.trim().toLowerCase()))
    .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime())
    .map((delivery) => ({
      id: delivery.id,
      turmaId: delivery.turmaId,
      studentId: delivery.studentId,
      turmaName: delivery.turma.name,
      studentName: delivery.student.name,
      parents: delivery.student.parents,
      parentId: delivery.student.parents.find((parent) => parent.email.trim().toLowerCase() === delivery.recipientEmail.trim().toLowerCase())?.id
        ?? delivery.student.parents.find((parent) => parent.name.trim().toLowerCase() === delivery.recipientName?.trim().toLowerCase())?.id
        ?? null,
      recipientName: delivery.recipientName,
      recipientEmail: delivery.recipientEmail,
      status: delivery.status,
      error: delivery.error,
      attemptedAt: delivery.attemptedAt.toISOString(),
    }));

  const turmaNames = new Map(turmas.map((turma) => [turma.id, turma.name]));
  const trackedEmails = new Set(deliveries.map((delivery) => `${delivery.studentId}:${delivery.recipientEmail.trim().toLowerCase()}`));
  const untrackedIssues = activeStudents.flatMap((student) => {
    const turmaName = turmaNames.get(student.turmaId);
    if (!turmaName) return [];
    return student.parents.flatMap((parent) => {
      const email = parent.email.trim().toLowerCase();
      if (!isSendableEmailAddress(email) || trackedEmails.has(`${student.id}:${email}`)) return [];
      trackedEmails.add(`${student.id}:${email}`);
      return [{
        id: `not-sent:${student.id}:${parent.id}`,
        turmaId: student.turmaId,
        studentId: student.id,
        turmaName,
        studentName: student.name,
        parents: student.parents,
        parentId: parent.id,
        recipientName: parent.name,
        recipientEmail: email,
        status: "NOT_SENT" as const,
        error: "Este endereço de e-mail ainda não tem um envio registado para o período selecionado.",
        attemptedAt: null,
      }];
    });
  });
  issues.push(...untrackedIssues);
  issues.sort((a, b) => (b.attemptedAt ? new Date(b.attemptedAt).getTime() : 0) - (a.attemptedAt ? new Date(a.attemptedAt).getTime() : 0));

  return NextResponse.json({ summary, issues });
}
