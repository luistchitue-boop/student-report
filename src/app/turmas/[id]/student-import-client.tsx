"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function StudentImportClient({ turmaId }: { turmaId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState("");

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
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível importar o ficheiro.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <button type="button" className="student-import-button" onClick={() => inputRef.current?.click()} disabled={isImporting}>
        {isImporting ? "A importar..." : "Importar .xlsx"}
      </button>
      <input ref={inputRef} className="student-import-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importFile} />
      {status && <p className="student-import-status">{status}</p>}
    </>
  );
}