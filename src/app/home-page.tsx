"use client";

import { FormEvent, useState } from "react";
import { signOut, useSession } from "next-auth/react";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const reportUrl = (slug: string) => `${appUrl}/reports/${slug}.pdf`;

const reports = [
  { id: "weekly", name: "Relatorio academico semanal", date: "Today", size: "PDF link", url: reportUrl("relatorio-academico-semanal") },
  { id: "term-1", name: "Relatorio academico do primeiro trimestre", date: "28 Mar 2026", size: "1.5 MB", url: reportUrl("relatorio-primeiro-trimestre") },
  { id: "attendance", name: "Resumo de presencas · 2026", date: "12 Jun 2026", size: "820 KB", url: reportUrl("resumo-presencas-2026") },
];

export default function HomePage() {
  const { data: session } = useSession();
  const [reportList, setReportList] = useState(reports);
  const [selectedReport, setSelectedReport] = useState(reports[0]);
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [email, setEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newReport, setNewReport] = useState({ name: "", url: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending"); setMessage("");
    try {
      const response = await fetch("/api/send-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, email, channel, reportUrl: selectedReport.url, reportName: selectedReport.name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send report");
      setStatus("sent"); setMessage("Report sent successfully");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Unable to send report"); }
  }

  function addReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const report = { id: `report-${Date.now()}`, name: newReport.name, date: "Today", size: "PDF link", url: newReport.url };
    setReportList((current) => [report, ...current]);
    setSelectedReport(report); setNewReport({ name: "", url: "" }); setShowAdd(false);
  }

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : session?.user?.email
      ? session.user.email.substring(0, 2).toUpperCase()
      : "U";

  return (
    <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">A</span><span>AEph <small>REPORTS</small></span></div><nav><a className="nav-active" href="#reports"><span>▦</span> Reports</a><a href="#activity"><span>↗</span> Activity</a></nav><div className="sidebar-footer"><div className="help-mark">?</div><div><strong>Need a hand?</strong><small>Read the sending guide</small></div></div></aside>
      <main className="main-content"><header className="topbar"><div><p className="eyebrow">GABINETE ESCOLAR / 2026</p><h1>Envio de relatórios</h1></div><div className="profile"><span className="status-dot" /> Conectado <span className="avatar" title={session?.user?.email ?? undefined}>{userInitials}</span><button className="sign-out-btn" onClick={() => signOut({ redirectTo: "/auth/signin" })}>Sair</button></div></header><section className="welcome"><div><p className="eyebrow accent">{channel === "email" ? "ENTREGA POR EMAIL" : channel === "sms" ? "ENTREGA POR SMS" : "ENTREGA POR WHATSAPP"}</p><h2>Envie um relatório,<br /><em>sem perder tempo.</em></h2><p className="lede">Partilhe links seguros de PDFs com as famílias em poucos toques.</p></div><div className="whatsapp-glyph">◔</div></section>
        <section className="workspace" id="reports"><div className="section-heading"><div><p className="eyebrow">BIBLIOTECA</p><h3>Relatórios disponíveis <span>{String(reportList.length).padStart(2, "0")}</span></h3></div><button className="outline-button" type="button" onClick={() => setShowAdd((current) => !current)}>＋ Adicionar</button></div>{showAdd && <form className="add-report" onSubmit={addReport}><input required placeholder="Nome do relatório" value={newReport.name} onChange={(event) => setNewReport({ ...newReport, name: event.target.value })} /><input required type="url" placeholder="https://seu-site.com/relatorio.pdf" value={newReport.url} onChange={(event) => setNewReport({ ...newReport, url: event.target.value })} /><button className="send-button" type="submit">Guardar</button></form>}<div className="reports-list">{reportList.map((report) => <button type="button" className={`report-row ${selectedReport.id === report.id ? "selected" : ""}`} key={report.id} onClick={() => { setSelectedReport(report); setStatus("idle"); }}><span className="pdf-icon">PDF</span><span className="report-details"><strong>{report.name}</strong><small>Adicionado {report.date} · {report.size}</small></span><span className="row-arrow">{selectedReport.id === report.id ? "✓" : "→"}</span></button>)}</div></section>
        <section className="send-panel" id="activity"><div className="panel-heading"><div><p className="eyebrow">PRONTO PARA ENVIAR</p><h3>Enviar relatório selecionado</h3></div><span className="selected-label">{selectedReport.name}</span></div><div className="channel-switch" role="group" aria-label="Canal de entrega"><button type="button" className={channel === "whatsapp" ? "active" : ""} onClick={() => setChannel("whatsapp")}>WhatsApp</button><button type="button" className={channel === "sms" ? "active" : ""} onClick={() => setChannel("sms")}>SMS</button><button type="button" className={channel === "email" ? "active" : ""} onClick={() => setChannel("email")}>Email</button></div><form onSubmit={sendReport}>{channel === "email" ? <><label htmlFor="email">Email do encarregado</label><div className="send-controls"><input id="email" type="email" required placeholder="encarregado@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="send-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "A enviar..." : "Enviar por Email  →"}</button></div></> : <><label htmlFor="phone">Número do encarregado {channel === "sms" ? "por SMS" : "por WhatsApp"}</label><div className="send-controls"><input id="phone" type="tel" required placeholder="+244 9XX XXX XXX" value={phone} onChange={(event) => setPhone(event.target.value)} /><button className="send-button" type="submit" disabled={status === "sending"}>{status === "sending" ? "A enviar..." : `Enviar por ${channel === "sms" ? "SMS" : "WhatsApp"}  →`}</button></div></>}<p className={`form-status ${status}`}>{message || (channel === "email" ? "O link do relatório será incluído no email." : "Inclua o código do país, por exemplo +244.")}</p></form></section><footer><span>Os links PDF são armazenados em segurança no Vercel.</span><span>Última entrega: hoje, 09:42</span></footer></main>
      <style>{`
        .sign-out-btn {
          margin-left: 1rem;
          padding: 0.5rem 1rem;
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }

        .sign-out-btn:hover {
          background-color: #e0e0e0;
        }
      `}</style>
    </div>
  );
}
