type MonthlyReportData = {
  grades: readonly unknown[];
  absences: readonly unknown[];
  weeklyObservations: readonly { behavior?: string | null; teacherObservation?: string | null }[];
};

export function hasMonthlyReportData(data: MonthlyReportData) {
  return data.grades.length > 0
    || data.absences.length > 0
    || data.weeklyObservations.some((observation) => Boolean(observation.behavior?.trim() || observation.teacherObservation?.trim()));
}
