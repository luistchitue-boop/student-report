import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { createParentContactConfirmationUrl } from "@/lib/parent-contact-confirmation";

const prisma = new PrismaClient();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ parentId: string }> }
) {
  const { parentId } = await params;
  const parent = await prisma.parent.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      student: {
        select: {
          id: true,
          name: true,
          turma: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!parent) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    parent: {
      id: parent.id,
      name: parent.name,
      phone: parent.phone,
      email: parent.email,
    },
    students: parent.student ? [{
      id: parent.student.id,
      name: parent.student.name,
      turma: parent.student.turma,
    }] : [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const { parentId } = await params;
    const body = await request.json();
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!phone) {
      return NextResponse.json({ error: "O telefone é obrigatório." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "O e-mail é obrigatório." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "O e-mail introduzido não é válido." }, { status: 400 });
    }

    const parent = await prisma.parent.findUnique({ where: { id: parentId } });
    if (!parent) {
      return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      return NextResponse.json({ error: "A confirmação por e-mail não está configurada." }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const confirmationUrl = createParentContactConfirmationUrl(parentId, phone, email, appUrl);
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Confirme a alteração dos seus contactos",
      text: `Caro encarregado de educação,\n\nFoi solicitada uma alteração dos seus contactos. Para confirmar, aceda a este link:\n${confirmationUrl}\n\nO link expira em 15 minutos. Se não realizou esta alteração, ignore este e-mail.`,
      html: `<!doctype html><html lang="pt"><body style="font-family:Arial,sans-serif;color:#173044;padding:32px"><h1>Confirmar alteração dos contactos</h1><p>Foi solicitada uma alteração dos seus contactos.</p><p><a href="${confirmationUrl}">Confirmar contactos</a></p><p>O link expira em 15 minutos.</p><p>Se não realizou esta alteração, ignore este e-mail.</p></body></html>`,
    });

    if (result.error) {
      return NextResponse.json({ error: `Não foi possível enviar o e-mail de confirmação: ${result.error.message}` }, { status: 502 });
    }

    return NextResponse.json({
      message: "Foi enviado um e-mail de confirmação. Consulte a sua caixa de entrada.",
      confirmationSent: true,
    });
  } catch (error) {
    console.error("Parent contact confirmation request failed:", error);
    return NextResponse.json({ error: "Não foi possível iniciar a confirmação dos contactos." }, { status: 500 });
  }
}
