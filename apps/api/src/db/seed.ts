import type { DatabaseSync } from 'node:sqlite';
import { createJobsRepository } from '../modules/jobs/repository.ts';
import type { JobInput } from '../modules/jobs/schemas.ts';
import { withTransaction } from './transaction.ts';

/**
 * Datos de ejemplo de data/ats.db (RF-07). Regla del taller: datos inventados siempre; nunca CVs, personas ni empresas
 * reales. Borradores completos y válidos (RN-02 a RN-04) con `created_at` fijos y escalonados: orden determinista.
 */
const SEED_JOBS: readonly { input: JobInput; createdAt: string }[] = [
  {
    input: {
      title: 'Analista de datos junior',
      description:
        'Apoyo al equipo de datos con informes periódicos y limpieza de datos. Formación inicial en SQL y visualización.',
      location: 'Sevilla',
      workMode: 'híbrida',
      salaryMin: 26000,
      salaryMax: 31000,
    },
    createdAt: '2026-09-21T08:00:00.000Z',
  },
  {
    input: {
      title: 'Técnico/a de soporte IT',
      description:
        'Atención de incidencias de puesto de trabajo y mantenimiento de equipos en oficina. Turno de mañana.',
      location: 'Zaragoza',
      workMode: 'presencial',
    },
    createdAt: '2026-09-24T09:30:00.000Z',
  },
  {
    input: {
      title: 'Diseñador/a de producto',
      description:
        'Diseño de flujos y prototipos para una aplicación interna de gestión. Colaboración estrecha con desarrollo.',
      location: 'Bilbao',
      workMode: 'remota',
    },
    createdAt: '2026-09-28T07:15:00.000Z',
  },
  {
    input: {
      title: 'Desarrollador/a frontend (React)',
      description:
        'Desarrollo de interfaces accesibles con React y TypeScript. Revisión de código y pruebas automatizadas.',
      location: 'Valencia',
      workMode: 'híbrida',
      salaryMin: 34000,
      salaryMax: 42000,
    },
    createdAt: '2026-10-01T10:00:00.000Z',
  },
];

/** Títulos del seed en el orden del listado (fecha de referencia descendente). */
export const SEED_TITLES_IN_LIST_ORDER: readonly string[] = SEED_JOBS.map(
  ({ input }) => input.title,
).reverse();

export function seed(db: DatabaseSync): void {
  const repository = createJobsRepository(db);
  withTransaction(db, () => {
    for (const { input, createdAt } of SEED_JOBS) repository.insert(input, createdAt);
  });
}
