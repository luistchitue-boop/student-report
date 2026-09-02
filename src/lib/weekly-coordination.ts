export type WeeklyPeriod = {
  start: Date;
  end: Date;
  key: string;
  isTest?: boolean;
};

export function getWeeklyCoordinationPeriods(year: number): WeeklyPeriod[] {
  const periods: WeeklyPeriod[] = [];
  const start = new Date(year, 8, 3, 12);
  const finalDate = new Date(year, 11, 31, 12);
  const testStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
  periods.push({ start: testStart, end: new Date(start.getTime() - 24 * 60 * 60 * 1000), key: formatPeriodDate(testStart), isTest: true });

  for (let current = start; current <= finalDate; current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    const end = new Date(Math.min(current.getTime() + 6 * 24 * 60 * 60 * 1000, finalDate.getTime()));
    periods.push({ start: current, end, key: formatPeriodDate(current) });
  }

  return periods;
}

export function formatPeriodDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isDateInPeriod(date: Date, period: WeeklyPeriod) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  return day >= period.start.getTime() && day <= period.end.getTime();
}