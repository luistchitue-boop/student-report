import { NextResponse } from "next/server";
import { Resend } from "resend";
import twilio from "twilio";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function POST(request: Request) {
  try {
    const { phone, email, channel = "whatsapp", reportUrl, reportName } = await request.json();
    if (channel !== "whatsapp" && channel !== "sms" && channel !== "email") return NextResponse.json({ error: "Canal de envio não suportado." }, { status: 400 });
    if ((channel === "email" && !email) || (channel !== "email" && !phone) || !reportUrl || !reportName) return NextResponse.json({ error: "O destinatário, o endereço do relatório e o nome do relatório são obrigatórios." }, { status: 400 });
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Introduza um endereço de e-mail válido." }, { status: 400 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resolvedReportUrl = new URL(reportUrl, appUrl).toString();
    const parsedUrl = new URL(resolvedReportUrl);
    if (parsedUrl.protocol !== "https:" || !resolvedReportUrl.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "O endereço do relatório deve ser um link PDF seguro em HTTPS." }, { status: 400 });
    if (channel === "email") {
      const { RESEND_API_KEY: apiKey, RESEND_FROM_EMAIL: fromEmail } = process.env;
      if (!apiKey || !fromEmail) return NextResponse.json({ error: "O e-mail não está configurado. Adicione RESEND_API_KEY e RESEND_FROM_EMAIL." }, { status: 500 });
      const safeName = escapeHtml("Relatorio academico semanal");
      const safeReportUrl = escapeHtml(resolvedReportUrl);
      const logoUrl = `${appUrl.replace(/\/$/, "")}/school-logo.png`;
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `O seu relatório escolar está pronto | ${reportName}`,
        text: `Caro encarregado de educação,\n\nTemos o prazer de partilhar o relatório ${reportName}. A nossa equipa preparou este documento com todo o cuidado para lhe dar uma visão clara da aprendizagem e do progresso do seu educando.\n\nAbrir o relatório: ${resolvedReportUrl}\n\nCom os melhores cumprimentos,\nNova Escola Politécnica do Huambo`,
        html: `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head><body style="margin:0;padding:0;background:#fff9df;font-family:Arial,Helvetica,sans-serif;color:#173044"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff9df;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff"><tr><td style="background:#d9edf3;padding:24px 32px;border-bottom:4px solid #f3c0bd"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle"><img src="${logoUrl}" width="56" height="56" alt="Logótipo da Nova Escola Politecnica do Huambo" style="display:block;width:56px;height:56px;object-fit:contain"></td><td valign="middle" style="padding-left:14px"><div style="font-size:18px;font-weight:bold;color:#173044;letter-spacing:.2px">Nova Escola Politecnica do Huambo</div><div style="font-size:10px;letter-spacing:2px;color:#176b8b;margin-top:4px">Garantindo um ensino de qualidade no huambo</div></td></tr></table></td></tr><tr><td style="padding:38px 40px 34px"><div style="font-size:11px;letter-spacing:2px;color:#176b8b;font-weight:bold">RELATÓRIO ESCOLAR</div><h1 style="font-size:26px;line-height:1.25;color:#173044;margin:12px 0 18px">O seu relatório está pronto para leitura</h1><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 18px">Caro encarregado de educação,</p><p style="font-size:15px;line-height:1.7;color:#405564;margin:0 0 24px">Temos o prazer de partilhar o relatório abaixo. A nossa equipa preparou este documento com todo o cuidado para lhe dar uma visão clara da aprendizagem e do progresso do seu educando.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff1c2;border-left:4px solid #f3c0bd;margin:0 0 28px"><tr><td style="padding:18px 20px"><div style="font-size:10px;letter-spacing:1.5px;color:#71808a">RELATÓRIO</div><div style="font-size:16px;font-weight:bold;color:#173044;margin-top:7px">${safeName}</div></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:2px;background:#176b8b"><a href="${safeReportUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold">Abrir relatório &nbsp;→</a></td></tr></table><p style="font-size:12px;line-height:1.6;color:#71808a;margin:24px 0 0">Para sua segurança, este link abre o relatório a partir do nosso armazenamento seguro de documentos. Se o botão não funcionar, copie e cole este endereço no seu navegador:<br><a href="${safeReportUrl}" style="color:#176b8b;word-break:break-all">${safeReportUrl}</a></p><p style="font-size:15px;line-height:1.7;color:#405564;margin:28px 0 0">Com os melhores cumprimentos,<br><strong>Nova Escola Politecnica do Huambo</strong><br><a href="https://neph.ao" style="color:#f3c0bd;text-decoration:none">neph.ao</a></p></td></tr><tr><td style="background:#173044;padding:22px 32px;color:#d5dfe0;font-size:11px;line-height:1.6">Nova Escola Politecnica do Huambo<br>Esta mensagem foi enviada pela secretaria da escola relativamente a um relatório escolar.</td></tr></table></td></tr></table></body></html>`,
      });
      if (result.error) return NextResponse.json({ error: `Email error: ${result.error.message}` }, { status: 502 });
      return NextResponse.json({ id: result.data?.id });
    }
    const { TWILIO_ACCOUNT_SID: accountSid, TWILIO_AUTH_TOKEN: authToken } = process.env;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
    const smsFrom = process.env.TWILIO_SMS_FROM;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const smsContentSid = process.env.TWILIO_SMS_CONTENT_SID;
    const from = channel === "sms" ? smsFrom : whatsappFrom;
    const usesSmsTemplate = channel === "sms" && Boolean(smsContentSid && messagingServiceSid);
    if (channel === "sms" && smsContentSid && !messagingServiceSid) return NextResponse.json({ error: "TWILIO_SMS_CONTENT_SID requires TWILIO_MESSAGING_SERVICE_SID." }, { status: 500 });
    if (channel === "sms" && !usesSmsTemplate && (!smsFrom || smsFrom.startsWith("whatsapp:") || smsFrom === whatsappFrom)) return NextResponse.json({ error: "SMS is configured with the WhatsApp sender. Set TWILIO_SMS_FROM to a separate SMS-capable Twilio phone number, or configure a trial SMS Content Template." }, { status: 500 });
    if (!accountSid || !authToken) return NextResponse.json({ error: "Twilio is not configured. Add the required environment variables." }, { status: 500 });
    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    const isWhatsApp = channel === "whatsapp";
    if (!isWhatsApp && smsContentSid && messagingServiceSid) {
      const result = await twilio(accountSid, authToken).messages.create({ to: normalizedPhone, messagingServiceSid, contentSid: smsContentSid, contentVariables: JSON.stringify({ "1": reportName, "2": resolvedReportUrl }) });
      return NextResponse.json({ sid: result.sid });
    }
    if (!from) return NextResponse.json({ error: "O remetente Twilio não está configurado." }, { status: 500 });
    const result = await twilio(accountSid, authToken).messages.create({ from: isWhatsApp && !from.startsWith("whatsapp:") ? `whatsapp:${from}` : from, to: isWhatsApp ? `whatsapp:${normalizedPhone}` : normalizedPhone, body: `O relatório escolar do aluno está pronto: ${reportName}\n${resolvedReportUrl}`, ...(isWhatsApp ? { mediaUrl: [resolvedReportUrl] } : {}) });
    return NextResponse.json({ sid: result.sid });
  } catch (error) {
    console.error("Twilio send failed", error);
    const twilioError = error as { code?: number; message?: string };
    return NextResponse.json({ error: twilioError.code ? `Erro do Twilio ${twilioError.code}: ${twilioError.message}` : "Não foi possível enviar o relatório. Verifique o número e as definições do Twilio." }, { status: 500 });
  }
}