import { auth } from "@/auth";
import { getSchoolContext } from "@/lib/school-context";

export async function GET() {
  const session = await auth();
  const school = session?.user?.id ? await getSchoolContext(session.user.id) : null;
  if (!school || !school.school.reportsEnabled) {
    return Response.json({ error: "A geração de relatórios está desativada para esta escola." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  return Response.json({ allowed: true }, { headers: { "Cache-Control": "private, no-store" } });
}
