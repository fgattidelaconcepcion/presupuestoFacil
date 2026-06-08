export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  // Mostrar la fecha en UTC para que coincida con lo guardado en BD
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Construye una fecha UTC pura (sin desfasaje de zona horaria).
 */
function utcMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Devuelve el lunes y sábado UTC de la semana que contiene referenceDate.
 * Garantiza que weekStart SIEMPRE es lunes y weekEnd SIEMPRE es sábado,
 * sin importar la zona horaria del servidor o del cliente.
 */
export function getWeekDates(referenceDate?: Date) {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  const dayUTC = now.getUTCDay(); // 0=Dom, 1=Lun ... 6=Sáb
  const diffToMonday = dayUTC === 0 ? -6 : 1 - dayUTC;

  const weekStart = utcMidnight(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + diffToMonday,
  );
  const weekEnd = utcMidnight(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate() + 5,
  );

  return { weekStart, weekEnd };
}

/**
 * Dado el weekEnd de la última semana cerrada (sábado),
 * devuelve el lunes y sábado UTC de la semana siguiente.
 */
export function getNextWeekDates(lastWeekEnd: Date) {
  const base = new Date(lastWeekEnd);
  // Avanzar desde el sábado hasta el próximo lunes (+2 días)
  base.setUTCDate(base.getUTCDate() + 1);
  while (base.getUTCDay() !== 1) {
    base.setUTCDate(base.getUTCDate() + 1);
  }

  const weekStart = utcMidnight(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
  );
  const weekEnd = utcMidnight(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate() + 5,
  );

  return { weekStart, weekEnd };
}

export const DAYS_OF_WEEK = [
  { key: "lun", label: "Lun" },
  { key: "mar", label: "Mar" },
  { key: "mie", label: "Mié" },
  { key: "jue", label: "Jue" },
  { key: "vie", label: "Vie" },
  { key: "sab", label: "Sáb" },
];
