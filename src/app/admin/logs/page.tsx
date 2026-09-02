import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatDisplayName(name: string) {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return trimmed;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function formatInvolvedSubject(
  entity: string,
  details: Record<string, unknown> | null,
  turmaNames: Record<string, string>,
  studentNames: Record<string, string>
) {
  const parts = [entity];
  const subject = typeof details?.subject === "string" ? details.subject : "";
  const turmaId = typeof details?.turmaId === "string" ? details.turmaId : "";
  const studentIds = Array.isArray(details?.studentIds)
    ? details.studentIds.filter((id): id is string => typeof id === "string")
    : typeof details?.studentId === "string"
      ? [details.studentId]
      : [];

  if (subject) parts.push(subject);
  if (turmaId) parts.push(turmaNames[turmaId] ?? "Turma");
  if (studentIds.length === 1) {
    parts.push(formatDisplayName(studentNames[studentIds[0]] ?? "Aluno"));
  } else if (studentIds.length > 1) {
    parts.push(`${studentIds.length} alunos`);
  }

  return parts.join(" • ");
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    redirect("/");
  }

  const params = searchParams ? await searchParams : {};
  const turmaFilter = typeof params.turmaId === "string" ? params.turmaId : "";
  const fromFilter = typeof params.from === "string" ? params.from : "";
  const toFilter = typeof params.to === "string" ? params.to : "";

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  const filteredLogs = logs.filter((entry) => {
    const details = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : null;
    const turmaId = typeof details?.turmaId === "string" ? details.turmaId : "";
    const createdAt = new Date(entry.createdAt);

    if (turmaFilter && turmaId !== turmaFilter) return false;
    if (fromFilter && createdAt < new Date(`${fromFilter}T00:00:00Z`)) return false;
    if (toFilter && createdAt > new Date(`${toFilter}T23:59:59.999Z`)) return false;

    return true;
  });

  const turmas = await prisma.turma.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const studentIds = new Set<string>();
  const turmaIds = new Set<string>();
  for (const entry of filteredLogs) {
    const details = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : null;
    if (!details) continue;

    const pushIds = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") studentIds.add(item);
        }
        return;
      }
      if (typeof value === "string") studentIds.add(value);
    };

    pushIds(details.studentId);
    pushIds(details.studentIds);

    if (typeof details.turmaId === "string") turmaIds.add(details.turmaId);
  }

  const studentNames = Object.fromEntries(
    (await prisma.student.findMany({
      where: { id: { in: [...studentIds] } },
      select: { id: true, name: true },
    })).map((student) => [student.id, student.name])
  );

  const turmaNames = Object.fromEntries(
    (await prisma.turma.findMany({
      where: { id: { in: [...turmaIds] } },
      select: { id: true, name: true },
    })).map((turma) => [turma.id, turma.name])
  );

  return (
    <AppShell active="logs">
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ADMINISTRAÇÃO</p>
            <h1>Registo de atividades</h1>
          </div>
        </header>

        <section className="admin-shell workspace">
          <div className="panel-heading admin-heading">
            <div>
              <p className="eyebrow">AUDITORIA</p>
              <h3>Quem registou o quê e quando</h3>
            </div>
          </div>

          <form method="get" className="admin-log-filters">
            <label>
              <span>Turma</span>
              <select name="turmaId" defaultValue={turmaFilter}>
                <option value="">Todas as turmas</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>{turma.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>De</span>
              <input type="date" name="from" defaultValue={fromFilter} />
            </label>

            <label>
              <span>Até</span>
              <input type="date" name="to" defaultValue={toFilter} />
            </label>

            <div className="admin-log-filter-actions">
              <button type="submit" className="admin-submit">Filtrar</button>
              {(turmaFilter || fromFilter || toFilter) && (
                <a href="/admin/logs" className="admin-log-reset">Limpar</a>
              )}
            </div>
          </form>

          <div className="admin-log-list">
            {filteredLogs.length === 0 ? (
              <p className="admin-status idle">Ainda não existem registos de atividade para este filtro.</p>
            ) : (
              filteredLogs.map((entry) => {
                const details = entry.details && typeof entry.details === "object" ? (entry.details as Record<string, unknown>) : null;

                return (
                  <article key={entry.id} className="admin-log-item">
                    <div className="admin-log-cell admin-log-operation">
                      <span>Operação</span>
                      <strong>{entry.action}</strong>
                    </div>
                    <div className="admin-log-cell">
                      <span>Utilizador</span>
                      <strong>{entry.actorName}</strong>
                    </div>
                    <div className="admin-log-cell">
                      <span>Envolvido</span>
                      <strong>{formatInvolvedSubject(entry.entity, details, turmaNames, studentNames)}</strong>
                    </div>
                    <time dateTime={entry.createdAt.toISOString()}>{new Date(entry.createdAt).toLocaleString("pt-AO")}</time>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
