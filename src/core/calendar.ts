import { MoonPhase } from 'astronomy-engine';

export interface CalendarDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  moonPhaseDegrees: number;
  moonIlluminatedFraction: number;
}

export function buildCalendarMonth(anchor: Date, now = new Date()): CalendarDay[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1, 12);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const phase = MoonPhase(date);
    return {
      date,
      inMonth: date.getMonth() === month,
      isToday: date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate(),
      moonPhaseDegrees: phase,
      moonIlluminatedFraction: (1 - Math.cos(phase * Math.PI / 180)) / 2,
    };
  });
}

export function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}
