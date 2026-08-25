import { NextResponse } from "next/server";
import { Resend } from "resend";
import twilio from "twilio";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function POST(request: Request) {
  try {
    const { phone, email, channel = "whatsapp", reportUrl, reportName } = await request.json();
    if (channel !== "whatsapp" && channel !== "sms" && channel !== "email") return NextResponse.json({ error: "Unsupported delivery channel." }, { status: 400 });
    if ((channel === "email" && !email) || (channel !== "email" && !phone) || !reportUrl || !reportName) return NextResponse.json({ error: "Recipient, report URL, and report name are required." }, { status: 400 });
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const parsedUrl = new URL(reportUrl);
    if (parsedUrl.protocol !== "https:" || !reportUrl.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Report URL must be a secure HTTPS PDF link." }, { status: 400 });
    if (channel === "email") {
      const { RESEND_API_KEY: apiKey, RESEND_FROM_EMAIL: fromEmail } = process.env;
      if (!apiKey || !fromEmail) return NextResponse.json({ error: "Email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL." }, { status: 500 });
      const safeName = escapeHtml(reportName);
      const safeReportUrl = escapeHtml(reportUrl);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const logoUrl = `${appUrl.replace(/\/$/, "")}/school-logo.png`;
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `Your student report is ready | ${reportName}`,
        text: `Dear parent or guardian,\n\nWe are pleased to share ${reportName}. Our staff have carefully prepared this report to give you a clear view of your child's learning and progress.\n\nOpen the report: ${reportUrl}\n\nWith appreciation,\nAEph School`,
        html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head><body style="margin:0;padding:0;background:#f3f5f1;font-family:Arial,Helvetica,sans-serif;color:#202622"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f5f1;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff"><tr><td style="background:#e4f0e5;padding:24px 32px;border-bottom:4px solid #39755d"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle"><img src="${logoUrl}" width="56" height="56" alt="AEph School logo" style="display:block;width:56px;height:56px;object-fit:contain"></td><td valign="middle" style="padding-left:14px"><div style="font-size:18px;font-weight:bold;color:#202622;letter-spacing:.2px">AEph School</div><div style="font-size:10px;letter-spacing:2px;color:#39755d;margin-top:4px">LEARNING TOGETHER</div></td></tr></table></td></tr><tr><td style="padding:38px 40px 34px"><div style="font-size:11px;letter-spacing:2px;color:#39755d;font-weight:bold">STUDENT REPORT</div><h1 style="font-size:26px;line-height:1.25;color:#202622;margin:12px 0 18px">Your report is ready to read</h1><p style="font-size:15px;line-height:1.7;color:#4e5951;margin:0 0 18px">Dear parent or guardian,</p><p style="font-size:15px;line-height:1.7;color:#4e5951;margin:0 0 24px">We are pleased to share the latest report below. Our staff have carefully prepared it to give you a clear view of your child's learning and progress.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f1e9;border-left:4px solid #39755d;margin:0 0 28px"><tr><td style="padding:18px 20px"><div style="font-size:10px;letter-spacing:1.5px;color:#7a827d">REPORT</div><div style="font-size:16px;font-weight:bold;color:#202622;margin-top:7px">${safeName}</div></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:2px;background:#39755d"><a href="${safeReportUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold">Open report &nbsp;→</a></td></tr></table><p style="font-size:12px;line-height:1.6;color:#7a827d;margin:24px 0 0">For your security, this link opens the report from our secure document storage. If the button does not work, copy and paste this address into your browser:<br><a href="${safeReportUrl}" style="color:#39755d;word-break:break-all">${safeReportUrl}</a></p><p style="font-size:15px;line-height:1.7;color:#4e5951;margin:28px 0 0">With appreciation,<br><strong>AEph School</strong></p></td></tr><tr><td style="background:#202622;padding:22px 32px;color:#cbd3ca;font-size:11px;line-height:1.6">AEph School<br>This message was sent by the school office regarding a student report.</td></tr></table></td></tr></table></body></html>`,
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
      const result = await twilio(accountSid, authToken).messages.create({ to: normalizedPhone, messagingServiceSid, contentSid: smsContentSid, contentVariables: JSON.stringify({ "1": reportName, "2": reportUrl }) });
      return NextResponse.json({ sid: result.sid });
    }
    if (!from) return NextResponse.json({ error: "Twilio sender is not configured." }, { status: 500 });
    const result = await twilio(accountSid, authToken).messages.create({ from: isWhatsApp && !from.startsWith("whatsapp:") ? `whatsapp:${from}` : from, to: isWhatsApp ? `whatsapp:${normalizedPhone}` : normalizedPhone, body: `Your student report is ready: ${reportName}\n${reportUrl}`, ...(isWhatsApp ? { mediaUrl: [reportUrl] } : {}) });
    return NextResponse.json({ sid: result.sid });
  } catch (error) {
    console.error("Twilio send failed", error);
    const twilioError = error as { code?: number; message?: string };
    return NextResponse.json({ error: twilioError.code ? `Twilio error ${twilioError.code}: ${twilioError.message}` : "We couldn't send the report. Check the number and Twilio settings." }, { status: 500 });
  }
}