import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import twilio from "twilio";
import { auth } from "@/auth";
import { createActivityLog, describeActorName } from "@/lib/activity-log";
import { isSendableEmailAddress } from "@/lib/email-address";
import { generateInternshipReportPdf } from "@/lib/internship-report-pdf";
import { createInternshipReportShareSignature } from "@/lib/internship-report-share";

declare global {
  var prismaAdminInternshipReportSend: PrismaClient | undefined;
}

const prisma = globalThis.prismaAdminInternshipReportSend ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prismaAdminInternshipReportSend = prisma;

function escapeHtml(value: string) {
  return value.replace(/[&<>\'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function normalizeAngolaPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("244")) return `+${digits}`;
  return `+244${digits.replace(/^0/, "")}`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const reportId = typeof body.reportId === "string" ? body.reportId : "";
    const parentId = typeof body.parentId === "string" ? body.parentId : "";
    const channel = body.channel === "WHATSAPP" ? "WHATSAPP" : body.channel === "EMAIL" ? "EMAIL" : null;
    if (!reportId || !parentId || !channel) {
      return NextResponse.json({ error: "Selecione um relatório, encarregado e canal de envio." }, { status: 400 });
    }

    const report = await prisma.internshipPerformanceReport.findFirst({
      where: { id: reportId, student: { turma: { isInternship: true } } },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            turma: { select: { name: true } },
            parents: { where: { id: parentId }, select: { id: true, name: true, email: true, phone: true } },
          },
        },
        teacher: { select: { name: true } },
      },
    });
    const parent = report?.student.parents[0];
    if (!report || !parent) return NextResponse.json({ error: "O relatório ou encarregado selecionado não pertence a um aluno de estágio." }, { status: 404 });

    let recipientContact = "";
    if (channel === "EMAIL") {
      recipientContact = parent.email.trim();
      if (!isSendableEmailAddress(recipientContact)) return NextResponse.json({ error: "O encarregado selecionado não tem um endereço de e-mail válido." }, { status: 400 });
      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        return NextResponse.json({ error: "O envio de e-mail não está configurado (RESEND_API_KEY e RESEND_FROM_EMAIL)." }, { status: 503 });
      }
    } else {
      recipientContact = normalizeAngolaPhone(parent.phone);
      if (!recipientContact || recipientContact.replace(/\D/g, "").length < 8 || recipientContact.replace(/\D/g, "").length > 15) {
        return NextResponse.json({ error: "O encarregado selecionado não tem um número de telefone válido." }, { status: 400 });
      }
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
        return NextResponse.json({ error: "O envio por WhatsApp não está configurado (Twilio)." }, { status: 503 });
      }
    }

    const pdf = await generateInternshipReportPdf(report);
    let providerEmailId: string | undefined;
    let providerMessageSid: string | undefined;
    let deliveryError: string | undefined;

    if (channel === "EMAIL") {
      const firstName = parent.name.trim().split(/\s+/)[0] || "encarregado(a)";
      const period = `${report.periodStart.toISOString().slice(0, 10)} a ${report.periodEnd.toISOString().slice(0, 10)}`;
      try {
        const result = await new Resend(process.env.RESEND_API_KEY!).emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: recipientContact,
          subject: `Relatório de estágio de ${report.student.name} | ${period}`,
          text: `Estimado(a) ${firstName},\n\nSegue em anexo o relatório de acompanhamento de estágio de ${report.student.name}, referente ao período ${period}.\n\nCom os melhores cumprimentos,\nNova Escola Politécnica do Huambo`,
          html: `<p>Estimado(a) ${escapeHtml(firstName)},</p><p>Segue em anexo o relatório de acompanhamento de estágio de <strong>${escapeHtml(report.student.name)}</strong>, referente ao período ${escapeHtml(period)}.</p><p>Com os melhores cumprimentos,<br>Nova Escola Politécnica do Huambo</p>`,
          attachments: [{ content: pdf, filename: `relatorio-estagio-${report.student.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase() || "estagiario"}.pdf` }],
        });
        if (result.error) deliveryError = result.error.message;
        else providerEmailId = result.data?.id;
      } catch (error) {
        deliveryError = error instanceof Error ? error.message : "Não foi possível enviar o e-mail.";
      }
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const baseUrl = new URL(appUrl);
      if (baseUrl.protocol !== "https:") {
        return NextResponse.json({ error: "O envio por WhatsApp requer NEXT_PUBLIC_APP_URL configurado com HTTPS." }, { status: 503 });
      }
      const expires = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
      const signature = createInternshipReportShareSignature(report.id, expires);
      const pdfUrl = new URL("/api/admin/internship-reports/pdf", baseUrl);
      pdfUrl.searchParams.set("reportId", report.id);
      pdfUrl.searchParams.set("expires", String(expires));
      pdfUrl.searchParams.set("signature", signature);
      const from = process.env.TWILIO_WHATSAPP_FROM!;
      try {
        const sent = await twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!).messages.create({
          from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
          to: `whatsapp:${recipientContact}`,
          body: `Saudações, ${parent.name}. Segue o relatório de acompanhamento de estágio de ${report.student.name}, referente ao período ${report.periodStart.toISOString().slice(0, 10)} a ${report.periodEnd.toISOString().slice(0, 10)}.`,
          mediaUrl: [pdfUrl.toString()],
        });
        providerMessageSid = sent.sid;
      } catch (error) {
        deliveryError = error instanceof Error ? error.message : "Não foi possível enviar pelo WhatsApp.";
      }
    }

    const delivery = await prisma.internshipReportDelivery.create({
      data: {
        reportId: report.id,
        parentId: parent.id,
        recipientName: parent.name,
        recipientContact,
        channel,
        providerEmailId,
        providerMessageSid,
        status: deliveryError ? "FAILED" : "SENT",
        error: deliveryError ?? null,
      },
      select: { id: true, recipientName: true, recipientContact: true, channel: true, status: true, error: true, attemptedAt: true },
    });

    try {
      await createActivityLog({
        actorId: session.user.id,
        actorName: describeActorName(session.user),
        action: deliveryError ? "Falhou o envio de relatório de estágio ao encarregado" : "Enviou relatório de estágio ao encarregado",
        entity: "InternshipPerformanceReport",
        entityId: report.id,
        details: { studentId: report.student.id, parentId: parent.id, channel, status: delivery.status, deliveryId: delivery.id },
      });
    } catch (error) {
      console.error("Could not record internship report delivery activity:", error);
    }

    if (deliveryError) return NextResponse.json({ error: deliveryError, delivery }, { status: 502 });
    return NextResponse.json({ success: true, delivery });
  } catch (error) {
    console.error("Internship report delivery error:", error);
    return NextResponse.json({ error: "Não foi possível enviar o relatório de estágio." }, { status: 500 });
  }
}
