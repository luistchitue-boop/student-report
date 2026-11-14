"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

export function GradeScaleClient({ turmaId, initialScale, initialEducationType }: { turmaId: string; initialScale: number; initialEducationType: "ENSINO_GERAL" | "ENSINO_TECNICO" | null }) {
  const [scale, setScale] = useState(initialScale === 10 ? 10 : 20);
  const [educationType, setEducationType] = useState(initialEducationType ?? "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function saveScale() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch(`/api/turmas/${turmaId}/grade-scale`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeScale: scale, educationType: educationType || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar a escala.");
      setStatus("Escala guardada.");
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível guardar a escala.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="grade-scale-button" onClick={() => { setStatus(""); setOpen(true); }}>
        {educationType === "ENSINO_GERAL" ? "Ensino geral" : educationType === "ENSINO_TECNICO" ? "Ensino Técnico" : "Ensino não definido"} · 0-{scale}
      </Button>
      {status && <span className="grade-scale-status">{status}</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grade-scale-modal">
          <DialogCloseButton />
          <DialogHeader>
            <p className="eyebrow">CONFIGURAÇÃO DA TURMA</p>
            <DialogTitle>Classificação da turma</DialogTitle>
            <DialogDescription>Defina a escala de notas e o tipo de ensino da turma. O tipo será identificado nos relatórios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade-scale">Escala</Label>
              <Select value={String(scale)} onValueChange={(value) => setScale(Number(value))}>
                <SelectTrigger id="grade-scale" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">0-10</SelectItem>
                  <SelectItem value="20">0-20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="education-type">Tipo de ensino</Label>
              <Select value={educationType || null} onValueChange={(value) => setEducationType(value ?? "")}>
                <SelectTrigger id="education-type" className="w-full"><SelectValue placeholder="Não definido" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENSINO_GERAL">Ensino geral</SelectItem>
                  <SelectItem value="ENSINO_TECNICO">Ensino técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="grade-scale-actions">
            <Button type="button" variant="outline" className="new-student-cancel" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" className="new-student-submit" onClick={saveScale} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
