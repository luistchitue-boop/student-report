import { notFound } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { ParentContactEditor } from "./parent-contact-editor";

const prisma = new PrismaClient();

export const metadata = {
  title: "Atualizar contactos",
  description: "Atualize o telefone e o e-mail dos seus alunos.",
};

export default async function ParentContactPage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = await params;
  const parent = await prisma.parent.findUnique({
    where: { id: parentId },
    select: { id: true, name: true, phone: true, email: true },
  });

  if (!parent) {
    notFound();
  }

  const linkedParents = await prisma.parent.findMany({
    where: {
      name: parent.name,
      student: { active: true },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      student: {
        select: {
          id: true,
          name: true,
          turma: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ student: { name: "asc" } }],
  });

  const selectedParent = linkedParents.find((linkedParent) => linkedParent.id === parentId) ?? linkedParents[0];

  return <ParentContactEditor parent={selectedParent ?? parent} linkedParents={linkedParents} />;
}
