"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, Building2, Plus, School, Settings2 } from "lucide-react";

type SchoolMembership = {
  schoolId: string;
  role: string;
  school: { id: string; name: string };
};

type SchoolForm = {
  name: string;
  address: string;
  website: string;
  activationCode: string;
};

const emptyForm: SchoolForm = { name: "", address: "", website: "", activationCode: "" };

export function SchoolsManager() {
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/schools/active", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as escolas.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setMemberships(result.memberships ?? []);
        setActiveSchoolId(result.activeSchoolId ?? null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as escolas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          website: form.website.trim(),
          activationCode: form.activationCode.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar a escola.");

      setForm(emptyForm);
      setSuccess(`“${result.school.name}” foi criada. Esta escola está agora ativa.`);
      window.location.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível criar a escola.");
    } finally {
      setSaving(false);
    }
  }

  async function activateSchool(schoolId: string) {
    setError("");
    const response = await fetch("/api/schools/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error ?? "Não foi possível mudar de escola.");
      return;
    }
    window.location.reload();
  }

  return (
    <section className="schools-manager" aria-labelledby="schools-manager-title">
      <div className="schools-manager-heading">
        <div className="schools-manager-heading-icon" aria-hidden="true"><Building2 size={20} /></div>
        <div>
          <p className="eyebrow">MULTI-ESCOLA</p>
          <h2 id="schools-manager-title">Escolas</h2>
          <p>Adicione uma escola e mantenha os respetivos dados e acessos separados.</p>
        </div>
      </div>

      <div className="schools-manager-grid">
        <div className="schools-list-panel">
          <div className="schools-panel-title">
            <div>
              <span className="schools-panel-kicker"><School size={14} /> ACESSO DA SUA CONTA</span>
              <h3>Escolas disponíveis</h3>
            </div>
            <span className="schools-count">{loading ? "…" : memberships.length}</span>
          </div>

          {loading ? (
            <p className="schools-empty">A carregar escolas…</p>
          ) : memberships.length ? (
            <ul className="schools-list">
              {memberships.map((membership) => {
                const active = membership.schoolId === activeSchoolId;
                return (
                  <li className={`schools-list-item${active ? " active" : ""}`} key={membership.schoolId}>
                    <span className="schools-list-icon" aria-hidden="true"><Building2 size={17} /></span>
                    <span className="schools-list-details">
                      <strong>{membership.school.name}</strong>
                      <small>{membership.role === "ADMIN" ? "Administrador" : membership.role === "DIRECCAO" ? "Direção" : "Coordenador"}</small>
                    </span>
                    {active ? (
                      <span className="schools-active-badge"><BadgeCheck size={14} /> Ativa</span>
                    ) : (
                      <button className="schools-activate-button" type="button" onClick={() => void activateSchool(membership.schoolId)}>
                        Ativar <ArrowRight size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="schools-empty">Ainda não existem escolas associadas à sua conta.</p>
          )}
        </div>

        <form className="schools-create-panel" onSubmit={handleSubmit}>
          <div className="schools-panel-title">
            <div>
              <span className="schools-panel-kicker"><Plus size={14} /> NOVA ESCOLA</span>
              <h3>Registar escola</h3>
            </div>
            <Settings2 className="schools-create-decoration" size={19} aria-hidden="true" />
          </div>
          <p className="schools-create-description">A sua conta receberá acesso de administrador. Os alunos e as turmas começam vazios nesta escola.</p>

          <label className="schools-field">
            <span>Nome da escola <b aria-hidden="true">*</b></span>
            <input
              autoComplete="organization"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              maxLength={160}
              placeholder="Ex.: Escola Secundária Central"
              required
            />
          </label>
          <label className="schools-field">
            <span>Morada <small>Opcional</small></span>
            <input
              autoComplete="street-address"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              maxLength={300}
              placeholder="Rua, cidade"
            />
          </label>
          <label className="schools-field">
            <span>Website <small>Opcional</small></span>
            <input
              type="url"
              autoComplete="url"
              value={form.website}
              onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
              maxLength={300}
              placeholder="https://escola.ao"
            />
          </label>
          <label className="schools-field">
            <span>Código de ativação <b aria-hidden="true">*</b></span>
            <input
              type="password"
              autoComplete="off"
              value={form.activationCode}
              onChange={(event) => setForm((current) => ({ ...current, activationCode: event.target.value }))}
              maxLength={80}
              placeholder="Código fornecido pelo suporte"
              required
            />
            <small className="schools-code-hint">Cada código permite registar apenas uma escola.</small>
          </label>

          {error && <p className="schools-feedback error" role="alert">{error}</p>}
          {success && <p className="schools-feedback success" role="status">{success}</p>}

          <button className="schools-create-button" type="submit" disabled={saving || !form.name.trim() || !form.activationCode.trim()}>
            <Plus size={17} /> {saving ? "A registar…" : "Adicionar escola"}
          </button>
        </form>
      </div>
    </section>
  );
}
