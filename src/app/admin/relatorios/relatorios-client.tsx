"use client";

import { useState } from "react";
import { formatPeriodDate, getWeeklyCoordinationPeriods } from "@/lib/weekly-coordination";

export function RelatoriosClient({
  turmas,
}: {
  turmas: Array<{
    id: string;
    name: string;
    students: number;
    subjects: string[];
  }>;
}) {
  const weeklyPeriods = getWeeklyCoordinationPeriods(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function isFuturePeriod(periodKey: string) {
    return periodKey > formatPeriodDate(new Date());
  }

  function toggleTurma(turmaId: string) {
    setSelectedTurmas((current) =>
      current.includes(turmaId)
        ? current.filter((value) => value !== turmaId)
        : [...current, turmaId]
    );
  }

  async function handleSendReports() {
    if (!selectedPeriod) {
      setStatus("error");
      setMessage("Selecione um período semanal antes de escolher as turmas.");
      return;
    }

    if (!selectedTurmas.length) {
      setStatus("error");
      setMessage("Selecione pelo menos uma turma antes de enviar.");
      return;
    }

    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaIds: selectedTurmas, periodKey: selectedPeriod }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível enviar os relatórios.");
      }

      setStatus("success");
      setMessage(`Relatórios enviados com sucesso: ${data.sent ?? 0} e-mail(s) enviados.`);
      setSelectedTurmas([]);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Ocorreu um erro ao enviar os relatórios.");
    }
  }

  return (
    <section className="admin-shell workspace">
      <div className="section-heading admin-heading">
        <div>
          <p className="eyebrow">SELECIONE AS TURMAS</p>
          <h3>Gerar e enviar relatórios por e-mail</h3>
        </div>
      </div>

      <div className="weekly-period-selector admin-report-period">
        <label>Período semanal
          <select value={selectedPeriod} onChange={(event) => { setSelectedPeriod(event.target.value); setSelectedTurmas([]); setMessage(""); setStatus("idle"); }}>
            <option value="">Selecione um período</option>
            {weeklyPeriods.map((period) => (
              <option key={period.key} value={period.key} disabled={isFuturePeriod(period.key)}>
                {period.start.toLocaleDateString("pt-AO")} - {period.end.toLocaleDateString("pt-AO")}{isFuturePeriod(period.key) ? " (futuro)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-turma-panel">
        <div className="admin-turma-grid">
          {turmas.map((turma) => (
            <label key={turma.id} className={`admin-checkbox ${selectedTurmas.includes(turma.id) ? "selected" : ""} ${!selectedPeriod ? "disabled" : ""}`}>
              <input
                type="checkbox"
                disabled={!selectedPeriod}
                checked={selectedTurmas.includes(turma.id)}
                onChange={() => toggleTurma(turma.id)}
              />
              <span>
                <strong>{turma.name}</strong>
                <small>{turma.students} alunos</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="admin-actions">
        <button
          className="admin-submit"
          type="button"
          onClick={handleSendReports}
          disabled={status === "sending" || !selectedPeriod || selectedTurmas.length === 0}
        >
          {status === "sending" ? "A enviar..." : "Enviar relatórios"}
        </button>
      </div>

      {message && <p className={`admin-status ${status}`}>{message}</p>}

      <style>{`
        .admin-shell {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .admin-heading {
          margin-bottom: 0;
        }

        .admin-turma-panel {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 1.2rem;
        }

        .admin-report-period {
          max-width: 520px;
        }

        .admin-turma-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.9rem;
        }

        .admin-checkbox {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          background: white;
          border: 1px solid #dbe3ec;
          border-radius: 12px;
          padding: 0.9rem 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .admin-checkbox.selected {
          border-color: #1d4ed8;
          background: #eff6ff;
        }

        .admin-checkbox.disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .admin-checkbox input {
          accent-color: #2563eb;
        }

        .admin-checkbox span {
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
        }

        .admin-checkbox small {
          color: #64748b;
        }

        .admin-actions {
          display: flex;
          justify-content: flex-start;
        }

        .admin-submit {
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 0.8rem 1.2rem;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
        }

        .admin-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .admin-status {
          margin: 0;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          font-size: 0.92rem;
        }

        .admin-status.success {
          background: #dcfce7;
          color: #166534;
        }

        .admin-status.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .admin-status.sending {
          background: #dbeafe;
          color: #1d4ed8;
        }
      `}</style>
    </section>
  );
}
