import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

declare global {
  var prismaResendWebhook: PrismaClient | undefined;
}

const prisma = globalThis.prismaResendWebhook ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prismaResendWebhook = prisma;

type ResendDeliveryEvent = {
  type?: string;
  data?: {
    email_id?: string;
    reason?: string;
    error?: string;
    bounce?: { message?: string; type?: string };
  };
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });

  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Cabeçalhos de assinatura em falta." }, { status: 400 });

  let event: ResendDeliveryEvent;
  try {
    const payload = await request.text();
    event = new Resend().webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret }) as unknown as ResendDeliveryEvent;
  } catch {
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) return NextResponse.json({ received: true, ignored: "missing-email-id" });

  const status = event.type === "email.delivered"
    ? "DELIVERED"
    : event.type === "email.bounced"
      ? "BOUNCED"
      : event.type === "email.delivery_delayed"
        ? "DELAYED"
        : event.type === "email.failed"
          ? "FAILED"
          : null;
  if (!status) return NextResponse.json({ received: true, ignored: "unsupported-event" });

  const reason = event.data?.bounce?.message
    ?? event.data?.bounce?.type
    ?? event.data?.reason
    ?? event.data?.error
    ?? null;
  const updated = await prisma.reportDelivery.updateMany({
    where: { providerEmailId: emailId, channel: "EMAIL" },
    data: { status, error: status === "DELIVERED" ? null : reason ?? `Evento Resend: ${event.type}` },
  });

  return NextResponse.json({ received: true, updated: updated.count });
}
