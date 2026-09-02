import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function ActivityLogsPage() {
  const session = await auth();

  if (!session?.user || (session.user.role ?? "COORDENADOR") !== "ADMIN") {
    redirect("/");
  }

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

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

          <div className="admin-log-list">
            {logs.length === 0 ? (
              <p className="admin-status idle">Ainda não existem registos de atividade.</p>
            ) : (
              logs.map((entry) => (
                <article key={entry.id} className="admin-log-item">
                  <div className="admin-log-header">
                    <strong>{entry.actorName}</strong>
                    <span>{new Date(entry.createdAt).toLocaleString("pt-AO")}</span>
                  </div>
                  <p>{entry.action}</p>
                  <small>
                    {entry.entity} {entry.entityId ? `• ${entry.entityId}` : ""}
                  </small>
                  {entry.details ? (
                    <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
