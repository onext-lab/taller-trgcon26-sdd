import { madridCalendarDate } from '../../calendar.ts';
import type { CandidateProcesses } from './processes-port.ts';

/**
 * Fórmula única de retención (RN-07, `docs/RGPD.md` §3). Pura: sin reloj ni base de datos; quien la invoca aporta
 * los hechos. Las fechas de partida son el día natural en Europe/Madrid del instante UTC guardado (DEC-09).
 */

const CONSENT_MONTHS = 24;
const PROCESS_MONTHS = 6;

export interface RetentionFacts {
  createdAt: string;
  consentGivenAt: string | null;
  consentWithdrawnAt: string | null;
  processes: CandidateProcesses;
}

/** Suma meses a 'AAAA-MM-DD'; si el día no existe en el mes de destino, toma el último día de ese mes. */
export function addMonthsClamped(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError('Fecha no válida');
  }
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Plazos aplicables (día natural de fin de retención), en cualquier orden. */
function applicableDeadlines(facts: RetentionFacts): string[] {
  const { createdAt, consentGivenAt, consentWithdrawnAt, processes } = facts;
  const deadlines: string[] = [];
  if (consentGivenAt !== null && consentWithdrawnAt === null) {
    deadlines.push(addMonthsClamped(madridCalendarDate(consentGivenAt), CONSENT_MONTHS));
  }
  if (processes.lastProcessClosedAt !== null) {
    deadlines.push(
      addMonthsClamped(madridCalendarDate(processes.lastProcessClosedAt), PROCESS_MONTHS),
    );
  }
  if (!processes.hadAnyApplication) {
    deadlines.push(addMonthsClamped(madridCalendarDate(createdAt), PROCESS_MONTHS));
  }
  return deadlines;
}

/**
 * Fin de retención: `null` con una inscripción no final; si no, la más tardía de consentimiento vigente + 24 meses,
 * cierre del último proceso + 6 meses y alta + 6 meses (solo si nunca tuvo inscripciones). Lanza `Error` si no
 * aplica ningún plazo (el puerto incumple su contrato).
 */
export function computeRetentionEndsAt(facts: RetentionFacts): string | null {
  if (facts.processes.hasOpenApplication) return null;
  const deadlines = applicableDeadlines(facts);
  const latest = deadlines.sort().at(-1);
  if (latest === undefined) {
    throw new Error('Puerto de procesos incoherente: no aplica ningún plazo de retención');
  }
  return latest;
}
