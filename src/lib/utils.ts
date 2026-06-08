export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

// Returns the Mon-Sat week containing `date` (defaults to today)
export function getWeekDates(referenceDate?: Date) {
  const date = referenceDate ? new Date(referenceDate) : new Date();
  const day = date.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  saturday.setHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: saturday };
}

// Returns the Monday of the week AFTER the given date
export function getNextWeekDates(afterDate: Date) {
  const nextMonday = new Date(afterDate);
  nextMonday.setDate(afterDate.getDate() + 1);

  // Advance to next Monday if not already
  while (nextMonday.getDay() !== 1) {
    nextMonday.setDate(nextMonday.getDate() + 1);
  }

  nextMonday.setHours(0, 0, 0, 0);

  const saturday = new Date(nextMonday);
  saturday.setDate(nextMonday.getDate() + 5);
  saturday.setHours(23, 59, 59, 999);

  return { weekStart: nextMonday, weekEnd: saturday };
}

export const DAYS_OF_WEEK = [
  { key: "lun", label: "Lun" },
  { key: "mar", label: "Mar" },
  { key: "mie", label: "Mié" },
  { key: "jue", label: "Jue" },
  { key: "vie", label: "Vie" },
  { key: "sab", label: "Sáb" },
];
