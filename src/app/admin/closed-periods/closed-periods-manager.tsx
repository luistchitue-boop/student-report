"use client";

import { useEffect, useState } from "react";
import { getWeeklyCoordinationPeriods, formatPeriodDate } from "@/lib/weekly-coordination";

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

export function ClosedPeriodsManager() {
  const [weeklyPeriods, setWeeklyPeriods] = useState<WeeklyPeriodWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  async function loadPeriods() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/closed-periods");
      if (!response.ok) throw new Error("Não foi possível carregar os períodos.");
      const data = await response.json();
      
      const closedPeriodsMap = new Map<string, ClosedPeriod>(
        data.closedPeriods.map((p: ClosedPeriod) => [
          `${p.weekStart}|${p.weekEnd}`,
          p,
        ])
      );

      const allPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear()).map((period) => {
        const key = `${period.start.toISOString()}|${period.end.toISOString()}`;
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
    loadPeriods();
  }, []);

  async function handleTogglePeriod(period: WeeklyPeriodWithStatus) {
    if (period.isClosed) {
      await handleOpenPeriod(period);
    } else {
      setSelectedPeriod(formatPeriodDate(period.start));
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
      setSelectedPeriod(null);
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
    </div>
  );
}
