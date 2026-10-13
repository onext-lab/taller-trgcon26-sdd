import type { DatabaseSync } from 'node:sqlite';
import { addCalendarDays, madridCalendarDate } from '../calendar.ts';
import { createJobsRepository } from '../modules/jobs/repository.ts';
import type { JobInput } from '../modules/jobs/schemas.ts';
import { seedApplications } from './seed-applications.ts';
import { seedCandidates } from './seed-candidates.ts';
import { withTransaction } from './transaction.ts';

interface SeedJob {
  input: JobInput;
  createdAt: string;
  /** Si viene, la oferta se publica en esa fecha (`draft` → `published`). */
  publishedAt?: string;
  /** Si viene, la oferta se cierra en esa fecha (`published` → `closed`); exige `publishedAt`. */
  closedAt?: string;
  /** Si viene, el plazo de inscripción es el día de Madrid de `now` más (o menos, si es negativo) esos días (DD-11). */
  enrollmentDeadlineInDays?: number;
}

/**
 * Datos de ejemplo de data/ats.db (RF-07). Regla del taller: datos inventados siempre; nunca CVs, personas ni empresas
 * reales. 10 ofertas completas y válidas (RN-02 a RN-04) con fechas fijas en UTC: orden determinista. Las 4 primeras
 * son borradores; las 4 siguientes están publicadas y las 2 últimas, cerradas. Dos publicadas llevan plazo de inscripción
 * relativo al reset: la de backend, futuro (+14 días) y la contable, vencido (−3 días).
 */
const SEED_JOBS: readonly SeedJob[] = [
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
  {
    input: {
      title: 'Desarrollador/a backend (Node.js)',
      description:
        'Desarrollo de servicios y APIs con Node.js y bases de datos relacionales. Pruebas automatizadas y revisión de código.',
      location: 'Málaga',
      workMode: 'remota',
      salaryMin: 36000,
      salaryMax: 45000,
    },
    createdAt: '2026-09-29T09:00:00.000Z',
    publishedAt: '2026-10-02T08:00:00.000Z',
    enrollmentDeadlineInDays: 14,
  },
  {
    input: {
      title: 'Administrativo/a contable',
      description:
        'Registro de facturas, conciliación de cuentas y apoyo al cierre mensual. Se valora manejo de hojas de cálculo.',
      location: 'Murcia',
      workMode: 'presencial',
    },
    createdAt: '2026-09-22T07:45:00.000Z',
    publishedAt: '2026-09-25T10:15:00.000Z',
    // Plazo vencido y sin inscripciones: con ellas habría alguna creada después del plazo (INV-01 de FEAT-04).
    enrollmentDeadlineInDays: -3,
  },
  {
    input: {
      title: 'Técnico/a de selección de personal',
      description:
        'Gestión de procesos de selección de principio a fin: publicación de ofertas, entrevistas y seguimiento de candidaturas.',
      location: 'Valencia',
      workMode: 'híbrida',
      salaryMin: 30000,
      salaryMax: 37000,
    },
    createdAt: '2026-09-17T10:00:00.000Z',
    publishedAt: '2026-09-19T08:30:00.000Z',
  },
  {
    input: {
      title: 'Responsable de gestión de nóminas',
      description:
        'Coordinación del cálculo mensual de nóminas y de las cotizaciones. Interlocución con las gestorías externas.',
      location: 'Madrid',
      workMode: 'presencial',
      salaryMin: 38000,
      salaryMax: 46000,
    },
    createdAt: '2026-09-10T08:00:00.000Z',
    publishedAt: '2026-09-12T09:00:00.000Z',
  },
  {
    input: {
      title: 'Becario/a de marketing digital',
      description:
        'Apoyo en la gestión de redes sociales y en campañas de correo. Beca de seis meses con tutor asignado.',
      location: 'Barcelona',
      workMode: 'remota',
      salaryMin: 12000,
      salaryMax: 14000,
    },
    createdAt: '2026-08-25T10:00:00.000Z',
    publishedAt: '2026-08-27T08:00:00.000Z',
    closedAt: '2026-09-26T15:30:00.000Z',
  },
  {
    input: {
      title: 'Auxiliar de logística',
      description:
        'Preparación de pedidos, control de existencias y carga de mercancía en almacén. Turno de tarde.',
      location: 'Getafe',
      workMode: 'presencial',
    },
    createdAt: '2026-08-18T08:00:00.000Z',
    publishedAt: '2026-08-20T09:00:00.000Z',
    closedAt: '2026-09-15T16:00:00.000Z',
  },
];

/** Títulos del seed en el orden del listado: fecha de referencia (`publishedAt ?? createdAt`) descendente. */
export const SEED_TITLES_IN_LIST_ORDER: readonly string[] = [...SEED_JOBS]
  .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))
  .map(({ input }) => input.title);

/**
 * Carga las 10 ofertas, los 30 candidatos y las 40 inscripciones en una sola transacción. `now` es la referencia
 * de las altas de los candidatos y de las inscripciones de las ofertas publicadas (DD-10): `reset.ts` usa el reloj del sistema y los tests pasan un instante fijo.
 */
export function seed(db: DatabaseSync, now: Date = new Date()): void {
  const repository = createJobsRepository(db);
  withTransaction(db, () => {
    const today = madridCalendarDate(now.toISOString());
    const jobIds = SEED_JOBS.map((job) => {
      const { input, createdAt, publishedAt, closedAt, enrollmentDeadlineInDays: offset } = job;
      const enrollmentDeadline = offset === undefined ? null : addCalendarDays(today, offset);
      const { id } = repository.insert({ ...input, enrollmentDeadline }, createdAt);
      if (publishedAt) repository.markPublished(id, publishedAt);
      if (closedAt) repository.markClosed(id, closedAt);
      return id;
    });
    const candidateIds = seedCandidates(db, now);
    seedApplications(db, now, jobIds, candidateIds);
  });
}
