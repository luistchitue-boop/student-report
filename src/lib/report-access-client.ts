export async function assertReportAccess() {
  const response = await fetch("/api/schools/report-access", { cache: "no-store" });
  if (!response.ok) throw new Error("A geração de relatórios está desativada para esta escola.");
}
