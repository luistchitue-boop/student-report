"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, BadgeCheck, Camera, CircleAlert, UserRound, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getDisplayName(name: string): string {
  const nameParts = name.trim().split(/\s+/).filter(Boolean);
  return nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : nameParts[0] ?? name;
}

export function StudentCardClient({
  turmaId,
  student,
  availableTurmas,
  isAdmin,
}: {
  turmaId: string;
  student: { id: string; name: string; attendance: string; active: boolean; avatarUrl?: string | null };
  availableTurmas: Array<{ id: string; name: string }>;
  isAdmin: boolean;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(student.active);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedState, setSelectedState] = useState<boolean>(isActive);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl ?? "");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [destinationTurmaId, setDestinationTurmaId] = useState(availableTurmas[0]?.id ?? "");
  const [isTransferring, setIsTransferring] = useState(false);
  const [confirmation, setConfirmation] = useState<"delete" | "transfer" | null>(null);

  const handleOpenModal = () => {
    setSelectedState(isActive);
    setError(null);
    setConfirmation(null);
    setShowModal(true);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/turmas/${turmaId}/students/${student.id}/avatar`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível guardar o avatar.");
      setAvatarUrl(result.avatarUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível guardar o avatar.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleCloseModal = () => {
    setError(null);
    setConfirmation(null);
    setShowModal(false);
  };

  const handleSaveState = async () => {
    if (selectedState === isActive) {
      setShowModal(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const url = `/api/turmas/${turmaId}/students/${student.id}/toggle-active`;
      const response = await fetch(url, { method: "PATCH" });
      
      if (response.ok) {
        await response.json();
        setIsActive(selectedState);
        setShowModal(false);
      } else {
        let errorMessage = "Não foi possível guardar o estado do aluno";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = "Não foi possível guardar o estado do aluno.";
        }
        setError(errorMessage);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro ao conectar ao servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/turmas/${turmaId}/students/${student.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível eliminar o aluno.");
      window.location.reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível eliminar o aluno.");
      setIsDeleting(false);
    }
  };

  const handleTransfer = async () => {
    if (!destinationTurmaId) return;

    setIsTransferring(true);
    setError(null);
    try {
      const response = await fetch(`/api/turmas/${turmaId}/students/${student.id}/transfer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationTurmaId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível transferir o aluno.");
      window.location.reload();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : "Não foi possível transferir o aluno.");
      setIsTransferring(false);
    }
  };

  const destinationTurma = availableTurmas.find((turma) => turma.id === destinationTurmaId);

  return (
    <>
      <Card className="h-full border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full flex-col items-center gap-4 pt-5 text-center">
          <div className="relative">
            <Link href={`/turmas/${turmaId}/${encodeURIComponent(student.id)}`} className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`Ver registo de ${student.name}`}>
              <Avatar size="lg" className="size-28">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={`Fotografia de ${student.name}`} />}
                <AvatarFallback><UserRound className="size-6" /></AvatarFallback>
              </Avatar>
            </Link>
            {isAdmin && (
              <>
                <Button type="button" size="icon" variant="secondary" className="absolute -right-2 -bottom-1 size-7 rounded-full shadow-sm" onClick={() => avatarInputRef.current?.click()} disabled={avatarLoading} aria-label={`Alterar fotografia de ${student.name}`} title="Alterar fotografia">
                  <Camera />
                </Button>
                <input ref={avatarInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} disabled={avatarLoading} tabIndex={-1} aria-label={`Selecionar fotografia de ${student.name}`} />
              </>
            )}
          </div>

          <Link href={`/turmas/${turmaId}/${encodeURIComponent(student.id)}`} className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="max-w-full truncate font-semibold tracking-tight group-hover:text-primary">{getDisplayName(student.name)}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">Abrir registo <ArrowUpRight className="size-3" /></span>
          </Link>

          <Button
            type="button"
            onClick={handleOpenModal}
            disabled={isLoading}
            variant="outline"
            className={`w-full ${isActive ? "border-emerald-600/20 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300" : "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"}`}
            title="Alterar o estado do aluno"
          >
            {isActive ? <BadgeCheck /> : <UserRoundX />}
            {isActive ? "Ativo" : "Inativo"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) { setError(null); setConfirmation(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogCloseButton />
          {confirmation ? (
            <>
              <DialogHeader>
                <DialogTitle>{confirmation === "delete" ? "Eliminar aluno?" : "Confirmar transferência?"}</DialogTitle>
                <DialogDescription>
                  {confirmation === "delete"
                    ? `O aluno ${student.name} e todos os seus dados serão eliminados. Esta ação não pode ser desfeita.`
                    : `O aluno ${student.name} será transferido para ${destinationTurma?.name ?? "a turma selecionada"}.`}
                </DialogDescription>
              </DialogHeader>
              {error && <p className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setConfirmation(null); setError(null); }} disabled={isDeleting || isTransferring}>Voltar</Button>
                <Button type="button" variant={confirmation === "delete" ? "destructive" : "default"} onClick={() => confirmation === "delete" ? void handleDelete() : void handleTransfer()} disabled={isDeleting || isTransferring}>
                  {isDeleting ? "A eliminar…" : isTransferring ? "A transferir…" : confirmation === "delete" ? "Eliminar aluno" : "Transferir aluno"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Gerir {getDisplayName(student.name)}</DialogTitle>
                <DialogDescription>Atualize o estado do aluno ou faça a gestão da matrícula.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Estado da matrícula</p>
                  <ToggleGroup
                    variant="outline"
                    value={[selectedState ? "active" : "inactive"]}
                    onValueChange={(value) => { if (value[0]) setSelectedState(value[0] === "active"); }}
                    aria-label="Estado da matrícula"
                    className="w-full"
                  >
                    <ToggleGroupItem value="active" className="flex-1"><BadgeCheck /> Ativo</ToggleGroupItem>
                    <ToggleGroupItem value="inactive" className="flex-1"><UserRoundX /> Inativo</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {isAdmin && availableTurmas.length > 0 && (
                  <div className="grid gap-2">
                    <Label htmlFor={`transfer-${student.id}`}>Transferir para outra turma</Label>
                    <Select value={destinationTurmaId || null} onValueChange={(value) => setDestinationTurmaId(value ?? "")} disabled={isTransferring || isLoading}>
                      <SelectTrigger id={`transfer-${student.id}`} className="w-full"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                      <SelectContent>
                        {availableTurmas.map((turma) => <SelectItem key={turma.id} value={turma.id}>{turma.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {error && <p className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>}
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
                {isAdmin ? <Button type="button" variant="destructive" onClick={() => { setError(null); setConfirmation("delete"); }} disabled={isDeleting || isLoading || isTransferring}>Eliminar aluno</Button> : <span />}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                  <Button type="button" onClick={() => void handleSaveState()} disabled={isLoading || isTransferring || selectedState === isActive}>
                    {isLoading ? "A guardar…" : "Guardar estado"}
                  </Button>
                  {isAdmin && availableTurmas.length > 0 && <Button type="button" variant="secondary" onClick={() => { setError(null); setConfirmation("transfer"); }} disabled={isLoading || isTransferring || !destinationTurmaId}>Transferir</Button>}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
