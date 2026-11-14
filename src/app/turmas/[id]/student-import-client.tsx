"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StudentImportClient({ turmaId }: { turmaId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setStatus("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/turmas/${turmaId}/students/import`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível importar o ficheiro.");
      setStatus(`${result.imported} aluno(s) importado(s), ${result.skipped} já existente(s) ignorado(s).${result.invalid ? ` ${result.invalid} linha(s) inválida(s) ignorada(s).` : ""}`);
      setStatusType("success");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível importar o ficheiro.");
      setStatusType("error");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isImporting}>
        {isImporting ? <Upload className="animate-pulse" /> : <FileSpreadsheet />}
        {isImporting ? "A importar…" : "Importar .xlsx"}
      </Button>
      <input ref={inputRef} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importFile} tabIndex={-1} aria-label="Selecionar ficheiro Excel para importar" />
      {status && <p className={`basis-full rounded-lg border px-3 py-2 text-sm ${statusType === "error" ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-primary/20 bg-primary/5 text-primary"}`} role={statusType === "error" ? "alert" : "status"}>{status}</p>}
    </div>
  );
}