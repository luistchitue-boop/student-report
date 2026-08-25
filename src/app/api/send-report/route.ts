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
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({ from: fromEmail, to: email, subject: `Student report: ${reportName}`, text: `Your student report is ready: ${reportName}\n\nOpen the PDF report: ${reportUrl}`, html: `<p>Your student report is ready: <strong>${safeName}</strong></p><p><a href="${reportUrl}">Open the PDF report</a></p>` });
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