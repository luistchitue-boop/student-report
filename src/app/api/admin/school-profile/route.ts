import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

const prisma = new PrismaClient();
const maxTemplateLength = 5000;

async function getAdminSchool() {
  const session = await auth();
  if (!session?.user?.id) return { error: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "ADMIN") {
    return { error: Response.json({ error: "Apenas administradores podem editar a escola ativa." }, { status: 403 }) };
  }
  return { schoolContext };
}

export async function GET() {
  const admin = await getAdminSchool();
  if ("error" in admin) return admin.error;
  return Response.json({ school: admin.schoolContext.school }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSchool();
  if ("error" in admin) return admin.error;

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 300) || null : null;
    const websiteInput = typeof body.website === "string" ? body.website.trim().slice(0, 300) : "";
    const reportEmailTemplate = typeof body.reportEmailTemplate === "string"
      ? body.reportEmailTemplate.slice(0, maxTemplateLength).trim() || null
      : null;

    if (!name) return Response.json({ error: "O nome da escola é obrigatório." }, { status: 400 });
    let website: string | null = null;
    if (websiteInput) {
      try {
        const parsed = new URL(websiteInput);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid protocol");
        website = parsed.toString();
      } catch {
        return Response.json({ error: "Introduza um endereço de website válido com http:// ou https://." }, { status: 400 });
      }
    }

    const school = await prisma.school.update({
      where: { id: admin.schoolContext.schoolId },
      data: { name, address, website, reportEmailTemplate },
      select: { id: true, name: true, address: true, website: true, logoUrl: true, reportEmailTemplate: true },
    });
    return Response.json({ school }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("School profile update error:", error);
    return Response.json({ error: "Não foi possível guardar os dados da escola." }, { status: 500 });
  }
}
