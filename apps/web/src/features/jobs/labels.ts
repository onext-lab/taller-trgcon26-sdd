import { formatInteger } from '../../components/format.ts';
import type { JobStatus, WorkMode } from './types.ts';

export const NOT_SPECIFIED_TEXT = 'Sin indicar';

const statusLabels: Record<JobStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  closed: 'Cerrada',
};

const workModeLabels: Record<WorkMode, string> = {
  presencial: 'Presencial',
  híbrida: 'Híbrida',
  remota: 'Remota',
};

export function jobStatusLabel(status: JobStatus): string {
  return statusLabels[status];
}

export function workModeLabel(workMode: WorkMode | null): string {
  return workMode === null ? NOT_SPECIFIED_TEXT : workModeLabels[workMode];
}

const fieldLabels: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  location: 'Ubicación',
  workMode: 'Modalidad',
  enrollmentDeadline: 'Fecha límite de inscripción',
};

/** Label of a job field named by the API in `details[i].field`; an unknown name is shown as received. */
export function jobFieldLabel(field: string): string {
  return fieldLabels[field] ?? field;
}

/** «Para publicar falta: Descripción, Modalidad.», in the order of the API `details`. */
export function missingFieldsText(fields: readonly string[]): string {
  return `Para publicar falta: ${fields.map(jobFieldLabel).join(', ')}.`;
}

/** DD-04: singular for 1, plural for anything else. */
export function activeApplicationsText(count: number): string {
  return count === 1
    ? 'Se rechazará 1 inscripción activa.'
    : `Se rechazarán ${count} inscripciones activas.`;
}

/** EC-13: «40.000 – 40.000 €/año», «Desde 32.000 €/año», «Hasta 40.000 €/año» or «Sin indicar». */
export function formatSalaryBand(salaryMin: number | null, salaryMax: number | null): string {
  if (salaryMin !== null && salaryMax !== null) {
    return `${formatInteger(salaryMin)} – ${formatInteger(salaryMax)} €/año`;
  }
  if (salaryMin !== null) return `Desde ${formatInteger(salaryMin)} €/año`;
  if (salaryMax !== null) return `Hasta ${formatInteger(salaryMax)} €/año`;
  return NOT_SPECIFIED_TEXT;
}
