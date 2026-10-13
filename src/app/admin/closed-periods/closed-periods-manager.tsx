"use client";

import { useEffect, useState } from "react";
import { getMonthlyCoordinationPeriods, getWeeklyCoordinationPeriods, formatPeriodDate, getPeriodLabel } from "@/lib/weekly-coordination";

type ClosedPeriod = {
  id: string;
  weekStart: string;
  weekEnd: string;
  closedAt: string;
  closedBy: { id: string; name: string | null; email: string };
  reason: string | null;
};

type WeeklyPeriodWithStatus = {
  start: Date;
  end: Date;
  key: string;
  isClosed: boolean;
  closedInfo?: ClosedPeriod;
};

type Turma = { id: string; name: string };
type MonthlyClosure = {
  id: string;
  turmaId: string;
  periodStart: string;
  periodEnd: string;
  closedAt: string;
  reason: string | null;
  turma: Turma;
  closedBy: { id: string; name: string | null; email: string };
};

function getAvailableMonthlyPeriods() {
  const currentYear = new Date().getFullYear();
  return [currentYear - 2, currentYear - 1, currentYear]
    .flatMap((year) => getMonthlyCoordinationPeriods(year))
    .filter((period) => period.start <= new Date())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}

export function ClosedPeriodsManager() {
  const [weeklyPeriods, setWeeklyPeriods] = useState<WeeklyPeriodWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [monthlyClosures, setMonthlyClosures] = useState<MonthlyClosure[]>([]);
  const monthlyPeriods = getAvailableMonthlyPeriods();
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthlyPeriods[0]?.key ?? "");
  const [selectedTurmaId, setSelectedTurmaId] = useState("");
  const [monthlyCloseReason, setMonthlyCloseReason] = useState("");

  async function loadPeriods() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/closed-periods");
      if (!response.ok) throw new Error("Não foi possível carregar os períodos.");
      const data = await response.json();
      setTurmas(data.turmas ?? []);
      setMonthlyClosures(data.monthlyClosures ?? []);
      
      const closedPeriodsMap = new Map<string, ClosedPeriod>(
        data.closedPeriods.map((p: ClosedPeriod) => [
          `${formatPeriodDate(new Date(p.weekStart))}|${formatPeriodDate(new Date(p.weekEnd))}`,
          p,
        ])
      );

      const allPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear()).map((period) => {
        const key = `${formatPeriodDate(period.start)}|${formatPeriodDate(period.end)}`;
        const closedInfo = closedPeriodsMap.get(key);
        return {
          ...period,
          isClosed: !!closedInfo,
          closedInfo,
        };
      });

      setWeeklyPeriods(allPeriods);
      setAction("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar períodos.");
      setAction("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(loadPeriods);
  }, []);

  async function handleTogglePeriod(period: WeeklyPeriodWithStatus) {
    if (period.isClosed) {
      await handleOpenPeriod(period);
    } else {
      setExpandedPeriod(formatPeriodDate(period.start));
      setCloseReason("");
    }
  }

  async function handleClosePeriod(period: WeeklyPeriodWithStatus) {
    setAction("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/closed-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          weekStart: period.start.toISOString(),
          weekEnd: period.end.toISOString(),
          reason: closeReason || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível fechar o período.");
      }

      setAction("success");
      setMessage(`Período de ${formatPeriodDate(period.start)} fechado com sucesso.`);
      setExpandedPeriod(null);
      setCloseReason("");
      loadPeriods();
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  async function handleOpenPeriod(period: WeeklyPeriodWithStatus) {
    setAction("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/closed-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          weekStart: period.start.toISOString(),
          weekEnd: period.end.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível reabrir o período.");
      }

      setAction("success");
      setMessage(`Período de ${formatPeriodDate(period.start)} reaberto com sucesso.`);
      loadPeriods();
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  async function toggleMonthlyClosure(closure?: MonthlyClosure) {
    const turmaId = closure?.turmaId ?? selectedTurmaId;
    const periodKey = closure
      ? `${formatPeriodDate(new Date(closure.periodStart))}|${formatPeriodDate(new Date(closure.periodEnd))}`
      : selectedMonthKey;
    if (!turmaId || !periodKey) return;
    setAction("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/closed-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: closure ? "openTurmaMonth" : "closeTurmaMonth",
          turmaId,
          periodKey,
          reason: closure ? undefined : monthlyCloseReason || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o fecho mensal.");
      const month = monthlyPeriods.find((period) => period.key === periodKey);
      const turmaName = turmas.find((turma) => turma.id === turmaId)?.name ?? closure?.turma.name ?? "turma";
      setMessage(closure ? `Período mensal reaberto para ${turmaName}.` : `Período mensal fechado para ${turmaName}.`);
      setMonthlyCloseReason("");
      await loadPeriods();
      if (!month) setSelectedMonthKey(periodKey);
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  if (loading) {
    return <div style={{ padding: "20px" }}>Carregando períodos...</div>;
  }

  const today = new Date();
  const closedCount = weeklyPeriods.filter((p) => p.isClosed).length;
  const openCount = weeklyPeriods.length - closedCount;

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "8px" }}>Gestão de Períodos Semanais</h3>
        <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
          {closedCount} períodos fechados · {openCount} períodos abertos
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "6px",
            backgroundColor: action === "error" ? "#fee" : "#efe",
            color: action === "error" ? "#c33" : "#3c3",
            fontSize: "14px",
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {weeklyPeriods.map((period) => {
          const isExpanded = expandedPeriod === formatPeriodDate(period.start);
          const startStr = formatPeriodDate(period.start);
          const endStr = formatPeriodDate(period.end);
          const isPast = period.end < today;

          return (
            <div
              key={startStr}
              style={{
                border: "1px solid #ddd",
                borderRadius: "6px",
                overflow: "hidden",
                backgroundColor: period.isClosed ? "#f5f5f5" : "#fff",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: period.isClosed ? "#f0f0f0" : "#fafafa",
                  borderBottom: isExpanded ? "1px solid #ddd" : "none",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                    {startStr} até {endStr}
                  </div>
                  <div style={{ fontSize: "13px", color: "#666" }}>
                    {period.isClosed ? (
                      <>
                        <span style={{ color: "#c33", fontWeight: 500 }}>● Fechado</span>
                        {period.closedInfo && (
                          <span style={{ marginLeft: "12px" }}>
                            por {period.closedInfo.closedBy.name || period.closedInfo.closedBy.email}
                          </span>
                        )}
                      </>
                    ) : isPast ? (
                      <span style={{ color: "#666" }}>Período passado · Aberto</span>
                    ) : (
                      <span style={{ color: "#3c3", fontWeight: 500 }}>● Aberto</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleTogglePeriod(period)}
                  disabled={action === "saving"}
                  style={{
                    padding: "8px 16px",
                    marginLeft: "12px",
                    backgroundColor: period.isClosed ? "#3c3" : "#c33",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: action === "saving" ? "not-allowed" : "pointer",
                    opacity: action === "saving" ? 0.6 : 1,
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {period.isClosed ? "Reabrir" : "Fechar"}
                </button>
              </div>

              {isExpanded && !period.isClosed && (
                <div style={{ padding: "16px", backgroundColor: "#fff", borderTop: "1px solid #ddd" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "6px",
                      }}
                    >
                      Motivo do encerramento (opcional)
                    </label>
                    <textarea
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      placeholder="Ex: Fim do período letivo"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        resize: "vertical",
                        minHeight: "60px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setExpandedPeriod(null);
                        setCloseReason("");
                      }}
                      disabled={action === "saving"}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#e0e0e0",
                        color: "#333",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleClosePeriod(period)}
                      disabled={action === "saving"}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: "#c33",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: action === "saving" ? "not-allowed" : "pointer",
                        opacity: action === "saving" ? 0.6 : 1,
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      {action === "saving" ? "Fechando..." : "Confirmar encerramento"}
                    </button>
                  </div>
                </div>
              )}

              {period.isClosed && period.closedInfo?.reason && (
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#fafafa",
                    borderTop: "1px solid #ddd",
                    fontSize: "13px",
                    color: "#666",
                  }}
                >
                  <strong>Motivo:</strong> {period.closedInfo.reason}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section style={{ marginTop: 36, padding: 20, border: "1px solid #d7e2dc", borderRadius: 12, background: "#fff" }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 8px" }}>Fecho mensal por turma</h3>
          <p style={{ color: "#58665f", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Ao fechar um mês para uma turma, os professores deixam de poder alterar faltas e justificações desse mês, nem notas, observações ou relatórios semanais dos períodos semanais inteiramente incluídos no mês.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12, marginBottom: 18 }}>
          <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 700 }}>
            Mês
            <select value={selectedMonthKey} onChange={(event) => setSelectedMonthKey(event.target.value)} style={{ minWidth: 210, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white" }}>
              {monthlyPeriods.map((period) => <option key={period.key} value={period.key}>{getPeriodLabel(period)}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 700 }}>
            Turma
            <select value={selectedTurmaId} onChange={(event) => setSelectedTurmaId(event.target.value)} style={{ minWidth: 210, padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "white" }}>
              <option value="">Selecione uma turma</option>
              {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => toggleMonthlyClosure()} disabled={action === "saving" || !selectedTurmaId || !selectedMonthKey || monthlyClosures.some((closure) => closure.turmaId === selectedTurmaId && `${formatPeriodDate(new Date(closure.periodStart))}|${formatPeriodDate(new Date(closure.periodEnd))}` === selectedMonthKey)} style={{ padding: "10px 16px", border: 0, borderRadius: 6, background: "#b42318", color: "white", fontWeight: 700, cursor: action === "saving" ? "wait" : "pointer", opacity: action === "saving" || !selectedTurmaId ? .6 : 1 }}>
            Fechar mês para turma
          </button>
        </div>
        <label style={{ display: "grid", gap: 6, marginBottom: 20, color: "#334155", fontSize: 13, fontWeight: 700 }}>
          Motivo do fecho (opcional)
          <textarea value={monthlyCloseReason} onChange={(event) => setMonthlyCloseReason(event.target.value)} placeholder="Ex.: Relatórios mensais enviados" rows={2} style={{ width: "100%", maxWidth: 600, padding: 10, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical" }} />
        </label>
        <h4 style={{ margin: "0 0 10px", color: "#334155" }}>Turmas fechadas no mês selecionado</h4>
        {monthlyClosures.filter((closure) => `${formatPeriodDate(new Date(closure.periodStart))}|${formatPeriodDate(new Date(closure.periodEnd))}` === selectedMonthKey).length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {monthlyClosures.filter((closure) => `${formatPeriodDate(new Date(closure.periodStart))}|${formatPeriodDate(new Date(closure.periodEnd))}` === selectedMonthKey).map((closure) => (
              <div key={closure.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff7f7" }}>
                <div><strong>{closure.turma.name}</strong><div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>Fechado por {closure.closedBy.name || closure.closedBy.email}{closure.reason ? ` · ${closure.reason}` : ""}</div></div>
                <button type="button" onClick={() => toggleMonthlyClosure(closure)} disabled={action === "saving"} style={{ padding: "7px 12px", border: "1px solid #b42318", borderRadius: 6, background: "white", color: "#b42318", fontWeight: 700, cursor: "pointer" }}>Reabrir turma</button>
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Ainda não há turmas fechadas para este mês.</p>}
      </section>
    </div>
  );
}
