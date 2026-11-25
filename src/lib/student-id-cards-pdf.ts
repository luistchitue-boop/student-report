import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import sharp from "sharp";
import { makeSchoolWebsiteQrTarget } from "@/lib/school-report-email";

type CardSchool = { id: string; name: string; logoUrl: string | null; address: string | null; website: string | null };
type CardStudent = { id: string; name: string; avatarUrl: string | null; turma: { name: string } };

// Keep the original palette available if the previous card design is preferred.
const cardPalettes = {
  original: {
    ink: [102, 68, 55], paper: [246, 229, 219], border: [225, 172, 149],
    panel: [252, 241, 235], accent: [181, 132, 112], stripe: [181, 132, 112],
    dots: [230, 187, 167], avatar: [220, 238, 224],
  },
  pastel: {
    ink: [48, 69, 92], paper: [247, 251, 254], border: [159, 185, 206],
    panel: [255, 253, 245], accent: [157, 83, 87], stripe: [225, 165, 165],
    dots: [233, 209, 147], avatar: [249, 232, 178],
  },
} as const;
const cardPalette = cardPalettes.pastel;

function formatTurmaName(name: string) {
  const match = name.trim().match(/^(\d+)\s*(\p{L}+)$/u);
  return match ? `${match[1]}.ª ${match[2]}` : name;
}

// Uploaded branding and avatars are public Vercel Blob files. Do not fetch arbitrary URLs.
async function imageData(url: string | null, circular = false) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    const response = await fetch(parsed, { signal: AbortSignal.timeout(8000), redirect: "error" });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return await prepareImage(bytes, circular);
  } catch {
    return null;
  }
}

async function prepareImage(bytes: Buffer, circular: boolean) {
  let image = sharp(bytes, { limitInputPixels: 25_000_000 }).rotate();
  if (circular) {
    const mask = Buffer.from('<svg width="128" height="128"><circle cx="64" cy="64" r="64" fill="white"/></svg>');
    image = image.resize(128, 128, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]);
  } else {
    image = image.resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  return `data:image/png;base64,${(await image.png().toBuffer()).toString("base64")}`;
}

export async function generateStudentIdCardsPdf(school: CardSchool, students: CardStudent[]) {
  let logo = await imageData(school.logoUrl);
  if (!school.logoUrl && school.id === "legacy-neph-school") {
    try { logo = await prepareImage(await readFile(path.join(process.cwd(), "public", "school-logo.png")), false); } catch { /* Logo is optional. */ }
  }
  const qrTarget = makeSchoolWebsiteQrTarget(school.website);
  const qrCode = qrTarget
    ? await QRCode.toDataURL(qrTarget, { errorCorrectionLevel: "M", margin: 4, width: 256 }).catch(() => null)
    : null;

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = 85.6;
  const height = 54;
  const startX = 15;
  const startY = 24;
  const gapX = 8.8;
  const gapY = 9;
  const { ink, paper, border, accent, stripe, dots, avatar: avatarBackground } = cardPalette;

  function drawPage() {
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("CARTÕES DE IDENTIFICAÇÃO", 15, 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Imprima em tamanho real e recorte pelo contorno.", 15, 18);
  }

  function fitText(text: string, maxWidth: number, maxSize: number, minSize: number) {
    let size = maxSize;
    pdf.setFontSize(size);
    while (size > minSize && pdf.getTextWidth(text) > maxWidth) pdf.setFontSize(--size);
    let result = text;
    while (result.length > 1 && pdf.getTextWidth(result) > maxWidth) result = `${result.slice(0, -2).trimEnd()}…`;
    return result;
  }

  drawPage();
  let pageAvatars: Array<string | null> = [];
  for (let index = 0; index < students.length; index += 1) {
    if (index % 8 === 0) {
      if (index > 0) { pdf.addPage(); drawPage(); }
      pageAvatars = await Promise.all(students.slice(index, index + 8).map((student) => imageData(student.avatarUrl, true)));
    }
    const student = students[index];
    const slot = index % 8;
    const avatar = pageAvatars[slot];
    const x = startX + (slot % 2) * (width + gapX);
    const y = startY + Math.floor(slot / 2) * (height + gapY);

    pdf.setFillColor(...paper);
    pdf.setDrawColor(...border);
    pdf.setLineWidth(0.35);
    pdf.rect(x, y, width, height, "FD");
    // Mirror the varied dot grid from the lower-left to the upper-right.
    pdf.setFillColor(...dots);
    for (let row = 0; 29 + row * 2.5 <= 46.5; row += 1) {
      for (let col = 0; 4 + col * 2.5 <= 41.5; col += 1) {
        const dotX = 4 + col * 2.5;
        const dotY = 29 + row * 2.5;
        const distance = Math.hypot((dotX - 22.75) / 18.75, (dotY - 37.75) / 8.75);
        const centreWeight = Math.max(0, 1 - distance);
        const variation = ((row * 73 + col * 37 + row * col * 19) % 7) / 6;
        const radius = 0.12 + variation * 0.16 + centreWeight * 0.65;
        pdf.circle(x + dotX, y + dotY, radius, "F");
        pdf.circle(x + width - dotX, y + height - dotY, radius, "F");
      }
    }
    pdf.setFillColor(...stripe);
    pdf.rect(x + 2.5, y + 49, width - 5, 1, "F");
    if (logo) pdf.addImage(logo, "PNG", x + 4, y + 3, 10, 10, undefined, "FAST");
    if (qrCode) pdf.addImage(qrCode, "PNG", x + width - 15, y + 0.5, 14, 14, "school-website-qr", "FAST");
    pdf.setTextColor(...ink);
    pdf.setFont("helvetica", "bold");
    pdf.text(fitText(school.name.toLocaleUpperCase(), width - (qrCode ? 34 : 21), 9, 6), x + 17, y + 7);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.text("CARTÃO DE ESTUDANTE", x + 17, y + 11);

    pdf.setFillColor(...avatarBackground);
    pdf.circle(x + 15, y + 29, 9, "F");
    if (avatar) pdf.addImage(avatar, "PNG", x + 6, y + 20, 18, 18, undefined, "FAST");
    else {
      pdf.setTextColor(...ink);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(student.name.trim().charAt(0).toLocaleUpperCase(), x + 15, y + 31.5, { align: "center" });
    }
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.6);
    pdf.circle(x + 15, y + 29, 9, "S");

    pdf.setTextColor(...accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.text("ALUNO(A)", x + 28, y + 21);
    pdf.setTextColor(...ink);
    pdf.text(fitText(student.name, width - 34, 10, 6), x + 28, y + 26);
    pdf.setFont("helvetica", "normal");
    pdf.text(fitText(`Turma: ${formatTurmaName(student.turma.name)}`, width - 34, 7.5, 6), x + 28, y + 32);
    pdf.text(fitText("Ano lectivo: 2026/2027", width - 34, 7, 5), x + 28, y + 37);
    if (school.address) {
      pdf.setFontSize(6);
      pdf.text(fitText(school.address, width - 12, 6, 5), x + 6, y + 44);
    }
  }
  return pdf.output("arraybuffer");
}