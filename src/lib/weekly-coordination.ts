export type ReportPeriodType = "WEEKLY" | "MONTHLY";

export type Period = {
  type: ReportPeriodType;
  start: Date;
  end: Date;
  key: string;
  isTest?: boolean;
};

export type WeeklyPeriod = Period & { type: "WEEKLY" };
export type MonthlyPeriod = Period & { type: "MONTHLY" };

export function getWeeklyCoordinationPeriods(year: number): WeeklyPeriod[] {
  const periods: WeeklyPeriod[] = [];
  const startDate = new Date(year, 8, 7, 12); // Sept 7
  const finalDate = new Date(year, 11, 31, 12);

  let current = new Date(startDate);
  const dayOfWeek = current.getDay();

  if (dayOfWeek !== 1) {
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    current = new Date(current.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  }

  while (current <= finalDate) {
    const end = new Date(current.getTime() + 4 * 24 * 60 * 60 * 1000);
    periods.push({ type: "WEEKLY", start: current, end, key: formatPeriodDate(current) });
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return periods;
}

export function getMonthlyCoordinationPeriods(year: number): MonthlyPeriod[] {
  const periods: MonthlyPeriod[] = [];
  const startMonth = new Date(year, 8, 1, 12);
  const endMonth = new Date(year + 1, 7, 31, 12);
  const current = new Date(startMonth);

  while (current <= endMonth) {
    const start = new Date(current.getFullYear(), current.getMonth(), 1, 12);
    const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12);
    periods.push({ type: "MONTHLY", start, end, key: `${formatPeriodDate(start)}|${formatPeriodDate(end)}` });
    current.setMonth(current.getMonth() + 1);
  }

  return periods;
}

export function getReportPeriods(year: number) {
  return [...getWeeklyCoordinationPeriods(year), ...getMonthlyCoordinationPeriods(year)].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function formatPeriodDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getPeriodType(periodKey: string): ReportPeriodType | undefined {
  return periodKey.includes("|") ? "MONTHLY" : "WEEKLY";
}

export function isDateInPeriod(date: Date, period: Period) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  return day >= period.start.getTime() && day <= period.end.getTime();
}

export function getPeriodLabel(period: Period) {
  return period.type === "MONTHLY"
    ? `${period.start.toLocaleDateString("pt-AO", { month: "long", year: "numeric" })}`
    : `${formatPeriodDate(period.start)} - ${formatPeriodDate(period.end)}`;
}

export function getPeriodRange(period: Period) {
  return `${formatPeriodDate(period.start)} - ${formatPeriodDate(period.end)}`;
}