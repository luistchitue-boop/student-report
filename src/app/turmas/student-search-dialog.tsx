"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Command, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCloseButton, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type StudentResult = { id: string; name: string; avatarUrl: string | null; turma: { id: string; name: string } };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export function StudentSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openSearch = useCallback(() => {
    setQuery("");
    setStudents([]);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      openSearch();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!open || normalizedQuery.length < 2) {
      const timer = window.setTimeout(() => { setStudents([]); setLoading(false); }, 0);
      return () => window.clearTimeout(timer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/turmas/students/search?q=${encodeURIComponent(normalizedQuery)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível pesquisar alunos.");
        setStudents(result.students ?? []);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") setStudents([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return <>
    <Button type="button" variant="outline" className="h-auto w-full justify-between gap-4 border-border/70 bg-card p-4 text-left shadow-sm hover:bg-card sm:p-5" onClick={openSearch}>
      <span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Search className="size-5" /></span><span className="grid min-w-0 gap-1"><span className="font-semibold">Pesquisar aluno</span><span className="truncate text-xs font-normal text-muted-foreground">Pesquise rapidamente em todas as turmas que pode consultar.</span></span></span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground sm:inline-flex"><Command className="size-3" /> Ctrl K</span>
    </Button>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="left-1/2 top-3 grid w-[calc(100vw-1.5rem)] min-w-0 max-h-[calc(100dvh-1.5rem)] -translate-x-1/2 translate-y-0 gap-0 overflow-hidden p-0 sm:top-[15%] sm:max-h-[min(76dvh,44rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl">
        <DialogHeader className="min-w-0 border-b px-4 py-4 pr-12 sm:px-5">
          <DialogTitle>Pesquisar aluno</DialogTitle>
          <DialogDescription>Os resultados são limitados às turmas disponíveis na escola ativa.</DialogDescription>
        </DialogHeader>
        <DialogCloseButton className="top-4 right-4" aria-label="Fechar pesquisa" />
        <div className="flex min-w-0 items-center gap-3 border-b px-4 sm:px-5">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <Input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escreva o nome do aluno…" className="h-14 min-w-0 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:border-0 focus-visible:ring-0" aria-label="Pesquisar pelo nome do aluno" autoComplete="off" />
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">Esc</Badge>
        </div>
        <div className="min-h-0 min-w-0 max-h-[calc(100dvh-13rem)] overflow-x-hidden overflow-y-auto p-2 sm:max-h-[min(54dvh,32rem)] sm:p-3" aria-live="polite" aria-busy={loading}>
          {query.trim().length < 2 ? <div className="grid min-h-40 place-content-center justify-items-center gap-2 text-center text-sm text-muted-foreground"><Users className="size-6" /><p>Escreva pelo menos 2 caracteres para pesquisar.</p></div>
            : loading ? <p className="p-8 text-center text-sm text-muted-foreground">A pesquisar…</p>
              : students.length ? <ul className="grid min-w-0 gap-1">{students.map((student) => <li key={`${student.turma.id}-${student.id}`} className="min-w-0">
                <Link href={`/turmas/${student.turma.id}/${encodeURIComponent(student.id)}`} onClick={() => setOpen(false)} className="flex min-h-16 w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg px-2 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-3">
                  <Avatar className="size-11"><AvatarImage src={student.avatarUrl ?? undefined} alt={student.name} /><AvatarFallback>{initials(student.name)}</AvatarFallback></Avatar>
                  <span className="grid min-w-0 flex-1 gap-1"><span className="line-clamp-2 whitespace-normal break-words text-sm font-medium leading-snug sm:truncate sm:whitespace-nowrap sm:leading-normal">{student.name}</span><span className="block truncate text-xs text-muted-foreground">{student.turma.name} · Abrir ficha do aluno</span></span>
                </Link>
              </li>)}</ul>
                : <div className="grid min-h-40 place-content-center justify-items-center gap-2 text-center"><p className="font-medium">Nenhum aluno encontrado</p><p className="text-sm text-muted-foreground">Experimente outro nome ou verifique as turmas disponíveis.</p></div>}
          {students.length === 20 && <p className="px-3 py-2 text-center text-xs text-muted-foreground">A mostrar os primeiros 20 resultados. Continue a escrever para restringir a pesquisa.</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5"><span>Pesquise por nome · máximo 20 resultados</span><span className="hidden sm:inline">Ctrl K para abrir</span></div>
      </DialogContent>
    </Dialog>
  </>;
}
