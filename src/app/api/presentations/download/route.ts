import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";
import { getCoordinatorPresentationTurmas, hasCoordinatorPresentationAccess } from "@/lib/teacher-data";
import { createPresentationFile, safePresentationFilename, validatePresentationDesign, validatePresentationPlan } from "@/lib/presentation-generator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Inicie sessão para descarregar apresentações." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 10_000_000) return Response.json({ error: "O pedido excede o tamanho permitido. Reduza o tamanho ou a quantidade de imagens." }, { status: 413 });
  const schoolContext = await getSchoolContext(session.user.id);
  if (!schoolContext || schoolContext.role !== "COORDENADOR") return Response.json({ error: "Esta ferramenta está disponível para coordenadores." }, { status: 403 });
  if (!await hasCoordinatorPresentationAccess(session.user.id, schoolContext.schoolId)) return Response.json({ error: "O administrador da escola ainda não ativou este recurso para a sua conta." }, { status: 403 });

  try {
    const body = await request.json();
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 120) : "";
    const level = typeof body.level === "string" ? body.level.trim().slice(0, 120) : "";
    const turmaId = typeof body.turmaId === "string" ? body.turmaId : "";
    if (!subject || !level) return Response.json({ error: "Indique a disciplina e o nível de ensino." }, { status: 400 });
    if (turmaId) {
      const turmas = await getCoordinatorPresentationTurmas(session.user.id);
      if (!turmas.some((turma) => turma.id === turmaId)) return Response.json({ error: "Não tem acesso a esta turma." }, { status: 403 });
    }

    const plan = validatePresentationPlan(body.plan);
    const design = validatePresentationDesign(body.design);
    const totalImageDataLength = plan.slides.reduce((total, slide) => total + (slide.imageData?.length ?? 0), design.coverImageData?.length ?? 0);
    if (totalImageDataLength > 8_000_000) return Response.json({ error: "O conjunto de imagens excede o tamanho total permitido." }, { status: 413 });
    const buffer = await createPresentationFile(plan, {
      subject,
      level,
      author: session.user.name || "Coordenação",
      school: schoolContext.school.name,
    }, design);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${safePresentationFilename(plan.title)}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Presentation export failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Não foi possível criar o ficheiro PowerPoint." }, { status: 400 });
  }
}
