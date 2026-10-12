import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { formatPeriodDate, type MonthlyPeriod } from "@/lib/weekly-coordination";

declare global {
  var prismaAdminDeliveryStatus: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminDeliveryStatus ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prismaAdminDeliveryStatus = prisma;

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
    prisma.student.findMany({ where: { active: true }, select: { id: true, turmaId: true } }),
    prisma.reportDelivery.findMany({
      where: { periodStart: period.start, channel: "EMAIL" },
      select: { id: true, turmaId: true, studentId: true, recipientName: true, recipientEmail: true, status: true, error: true, attemptedAt: true, student: { select: { name: true } }, turma: { select: { name: true } } },
    }),
  ]);

  const countsByTurma = new Map<string, { activeStudentIds: Set<string>; sentStudentIds: Set<string>; failed: number; bounced: number; delayed: number }>();
  for (const turma of turmas) countsByTurma.set(turma.id, { activeStudentIds: new Set(), sentStudentIds: new Set(), failed: 0, bounced: 0, delayed: 0 });
  for (const student of activeStudents) countsByTurma.get(student.turmaId)?.activeStudentIds.add(student.id);
  for (const delivery of deliveries) {
    const counts = countsByTurma.get(delivery.turmaId);
    if (!counts) continue;
    if (delivery.status === "SENT" || delivery.status === "DELIVERED") counts.sentStudentIds.add(delivery.studentId);
    if (delivery.status === "FAILED") counts.failed += 1;
    if (delivery.status === "BOUNCED") counts.bounced += 1;
    if (delivery.status === "DELAYED") counts.delayed += 1;
  }

  const summary = turmas.map((turma) => {
    const counts = countsByTurma.get(turma.id)!;
    const studentCount = counts.activeStudentIds.size;
    const sentCount = [...counts.sentStudentIds].filter((studentId) => counts.activeStudentIds.has(studentId)).length;
    return {
      id: turma.id,
      name: turma.name,
      studentCount,
      sentCount,
      percentage: studentCount ? Math.round((sentCount / studentCount) * 100) : 0,
      failedCount: counts.failed,
      bouncedCount: counts.bounced,
      delayedCount: counts.delayed,
    };
  });

  const issues = deliveries
    .filter((delivery) => delivery.status === "FAILED" || delivery.status === "BOUNCED" || delivery.status === "DELAYED")
    .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime())
    .map((delivery) => ({
      id: delivery.id,
      turmaId: delivery.turmaId,
      turmaName: delivery.turma.name,
      studentName: delivery.student.name,
      recipientName: delivery.recipientName,
      recipientEmail: delivery.recipientEmail,
      status: delivery.status,
      error: delivery.error,
      attemptedAt: delivery.attemptedAt.toISOString(),
    }));

  return NextResponse.json({ summary, issues });
}
