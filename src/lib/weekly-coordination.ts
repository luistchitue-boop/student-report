export type WeeklyPeriod = {
  start: Date;
  end: Date;
  key: string;
  isTest?: boolean;
};

export function getWeeklyCoordinationPeriods(year: number): WeeklyPeriod[] {
  const periods: WeeklyPeriod[] = [];
  const startDate = new Date(year, 8, 7, 12); // Sept 7
  const finalDate = new Date(year, 11, 31, 12);

  // Find the first Monday on or after Sept 7
  let current = new Date(startDate);
  const dayOfWeek = current.getDay();
  
  if (dayOfWeek !== 1) { // 1 = Monday
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    current = new Date(current.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  }

  while (current <= finalDate) {
    // End date is Friday of that week (4 days after Monday)
    const end = new Date(current.getTime() + 4 * 24 * 60 * 60 * 1000);
    
    periods.push({ start: current, end, key: formatPeriodDate(current) });
    
    // Move to next Monday (7 days after current Monday)
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
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