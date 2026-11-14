export type SchoolEmailTemplateValues = {
  recipientName: string;
  studentName: string;
  period: string;
  schoolName: string;
};

const templateTokens: Record<keyof SchoolEmailTemplateValues, string> = {
  recipientName: "{{recipientName}}",
  studentName: "{{studentName}}",
  period: "{{period}}",
  schoolName: "{{schoolName}}",
};

export function renderSchoolEmailTemplate(template: string, values: SchoolEmailTemplateValues) {
  return (Object.keys(templateTokens) as Array<keyof SchoolEmailTemplateValues>).reduce(
    (message, key) => message.split(templateTokens[key]).join(values[key]),
    template,
  );
}

export function schoolEmailTemplateHtml(message: string, schoolName: string, logoUrl?: string | null) {
  const escapeHtml = (value: string) => value.replace(/[&<>\'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
  const paragraphs = message.trim().split(/\n\s*\n/).map((paragraph) =>
    `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
  ).join("");
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="Logótipo de ${escapeHtml(schoolName)}" style="display:block;width:48px;height:48px;object-fit:contain">`
    : "";
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório escolar</title></head><body style="margin:0;padding:24px 12px;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#243746"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border:1px solid #e2e8ec;border-radius:12px"><tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8ec"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle">${logo}</td><td valign="middle" style="padding-left:12px;font-size:17px;font-weight:bold">${escapeHtml(schoolName)}</td></tr></table></td></tr><tr><td style="padding:28px 24px;font-size:15px">${paragraphs}</td></tr></table></td></tr></table></body></html>`;
}

export function makeSchoolWebsiteQrTarget(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
