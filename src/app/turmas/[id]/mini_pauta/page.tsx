import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getCoordinatorTurmaById } from "@/lib/teacher-data";
import { MiniPautaClient } from "./mini-pauta-client";

export default async function MiniPautaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { id } = await params;
  const turma = await getCoordinatorTurmaById(session.user.id, id);
  if (!turma) notFound();

  return (
    <AppShell active="turmas">
      <MiniPautaClient turma={turma} />
    </AppShell>
  );
}
