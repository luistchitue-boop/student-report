import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { generateInternshipReportPdf } from "@/lib/internship-report-pdf";
import { isValidInternshipReportShare } from "@/lib/internship-report-share";

declare global {
  var prismaAdminInternshipReportPdf: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminInternshipReportPdf ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prismaAdminInternshipReportPdf = prisma;

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "estagiario";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId") ?? "";
  if (!reportId) return NextResponse.json({ error: "Relatório obrigatório." }, { status: 400 });

  let validShare = false;
  try {
    validShare = isValidInternshipReportShare(reportId, searchParams.get("expires"), searchParams.get("signature"));
  } catch {
    validShare = false;
  }
  if (!validShare) {
    const session = await auth();
    if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
    }
  }

  try {
    const report = await prisma.internshipPerformanceReport.findFirst({
      where: { id: reportId, student: { turma: { isInternship: true } } },
      include: { student: { select: { name: true, turma: { select: { name: true } } } }, teacher: { select: { name: true } } },
    });
    if (!report) return NextResponse.json({ error: "Relatório de estágio não encontrado." }, { status: 404 });

    const pdf = generateInternshipReportPdf(report);
    const disposition = searchParams.get("download") === "1" ? "attachment" : "inline";
    const filename = `relatorio-estagio-${safeFileName(report.student.name)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Internship PDF generation error:", error);
    return NextResponse.json({ error: "Não foi possível gerar o PDF do relatório de estágio." }, { status: 500 });
  }
}
