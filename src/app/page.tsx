import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCoordinatorTurmas } from "@/lib/teacher-data";
import { PrismaClient } from "@prisma/client";
import HomePage from "./home-page";
import { getSchoolContext } from "@/lib/school-context";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const prisma = new PrismaClient();

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const [turmas, schoolContext] = await Promise.all([
    getCoordinatorTurmas(session.user.id),
    getSchoolContext(session.user.id),
  ]);
  if (!schoolContext) {
    return (
      <AppShell active="inicio">
        <main className="main-content">
          <Card className="shadow-sm">
            <CardHeader><CardTitle>Nenhuma escola ativa</CardTitle><CardDescription>Selecione uma escola disponível no menu. Se a sua escola estiver desativada, contacte o administrador da plataforma.</CardDescription></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Pode continuar a gerir as definições da sua conta.</CardContent>
          </Card>
        </main>
      </AppShell>
    );
  }
  const turmaIds = turmas.map((turma) => turma.id);
  const activeStudents = turmas.reduce((total, turma) => total + (turma.students ?? 0), 0);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const absencesToday = await prisma.absence.count({
    where: {
      dia: {
        gte: dayStart,
        lte: dayEnd,
      },
      student: {
        turmaId: {
          in: turmaIds,
        },
      },
    },
  });

  return (
    <HomePage
      stats={{
        turmas: turmas.length,
        activeStudents,
        absencesToday,
      }}
      role={schoolContext.role}
    />
  );
}
