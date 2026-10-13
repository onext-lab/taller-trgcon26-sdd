/**
 * Días naturales de Europe/Madrid (DEC-09, RNF-01). Transversal: no es un módulo de negocio, así que `jobs`,
 * `applications` y `candidates` pueden importarlo sin acoplarse entre sí (DEC-06). Las fechas son 'AAAA-MM-DD'.
 */

const MADRID_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const CALENDAR_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

/** Día natural 'AAAA-MM-DD' en Europe/Madrid de un instante ISO UTC. Lanza `RangeError` si el instante no es válido. */
export function madridCalendarDate(instant: string): string {
  const parts = MADRID_DAY.formatToParts(new Date(instant));
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Instante UTC a medianoche de 'AAAA-MM-DD' (`setUTCFullYear`: `Date.UTC` suma 1900 a los años < 100). */
function utcMidnight(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/** `true` si es 'AAAA-MM-DD' y un día que existe (ida y vuelta por UTC: rechaza 2027-02-29 y 2026-13-01). */
export function isCalendarDate(text: string): boolean {
  const match = CALENDAR_DATE.exec(text);
  if (match === null) return false;
  const date = utcMidnight(Number(match[1]), Number(match[2]), Number(match[3]));
  return date.toISOString().slice(0, 10) === text;
}

/** Suma (o resta, con negativos) días naturales a una 'AAAA-MM-DD' válida; aritmética UTC, sin horario de verano. */
export function addCalendarDays(date: string, days: number): string {
  const match = CALENDAR_DATE.exec(date);
  if (match === null) throw new RangeError('Fecha no válida');
  const result = utcMidnight(Number(match[1]), Number(match[2]), Number(match[3]));
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** 'AAAA-MM-DD' → 'dd/mm/aaaa'. */
export function formatCalendarDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** El plazo ha vencido si existe y es anterior a `today`; el propio día de la fecha límite aún admite inscripciones. */
export function isDeadlinePassed(deadline: string | null, today: string): boolean {
  return deadline !== null && deadline < today;
}
