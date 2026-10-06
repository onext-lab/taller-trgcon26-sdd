import type { DatabaseSync } from 'node:sqlite';
import { createCandidatesRepository } from '../modules/candidates/repository.ts';
import type { CandidateFields } from '../modules/candidates/repository.ts';
import { noCandidateProcesses } from '../modules/candidates/processes-port.ts';
import { computeRetentionEndsAt } from '../modules/candidates/retention.ts';
import { CONSENT_TEXT_VERSION } from '../modules/candidates/schemas.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Candidato del seed antes de fijar su fecha de alta y su consentimiento (dependen de la posición y de `now`). */
interface SeedCandidate {
  fullName: string;
  email: string;
  phone?: string;
  summary?: string;
  skills: string[];
}

/**
 * 30 candidatos inventados (RF-08, DT-08): todos con `@example.com`, nombre y email válidos según RF-02, 0-4 skills de
 * un conjunto de 12 y varios sin teléfono ni resumen. Nunca personas reales.
 */
const SEED_CANDIDATES: readonly SeedCandidate[] = [
  {
    fullName: 'Lucía Fernández Prieto',
    email: 'lucia.fernandez@example.com',
    phone: '+34 600 111 201',
    summary: 'Desarrolladora con tres años de experiencia en interfaces web.',
    skills: ['typescript', 'react'],
  },
  { fullName: 'Mateo Salgado Rey', email: 'mateo.salgado@example.com', skills: ['sql', 'python'] },
  {
    fullName: 'Irene Campos Vidal',
    email: 'irene.campos@example.com',
    phone: '600 111 203',
    skills: ['figma'],
  },
  {
    fullName: 'Hugo Barrios Lara',
    email: 'hugo.barrios@example.com',
    summary: 'Perfil comercial orientado a cuentas pequeñas y medianas.',
    skills: ['ventas', 'excel'],
  },
  { fullName: 'Marta Olmedo Cruz', email: 'marta.olmedo@example.com', skills: [] },
  {
    fullName: 'Álvaro Iglesias Mora',
    email: 'alvaro.iglesias@example.com',
    phone: '+34 600 111 206',
    skills: ['node.js', 'typescript', 'docker', 'aws'],
  },
  { fullName: 'Nerea Sandoval Pons', email: 'nerea.sandoval@example.com', skills: ['scrum'] },
  {
    fullName: 'Daniel Quintero Gil',
    email: 'daniel.quintero@example.com',
    summary: 'Analista de datos con experiencia en informes de ventas.',
    skills: ['sql', 'excel', 'python'],
  },
  {
    fullName: 'Paula Ferrer Aguirre',
    email: 'paula.ferrer@example.com',
    phone: '(34) 600 111 209',
    skills: ['java'],
  },
  { fullName: 'Sergio Lozano Vera', email: 'sergio.lozano@example.com', skills: ['docker', 'aws'] },
  {
    fullName: 'Carla Montero Díaz',
    email: 'carla.montero@example.com',
    summary: 'Diseñadora de producto, especializada en sistemas de diseño.',
    skills: ['figma', 'scrum'],
  },
  { fullName: 'Rubén Cabrera Soto', email: 'ruben.cabrera@example.com', skills: ['react'] },
  {
    fullName: 'Elena Navarro Ibáñez',
    email: 'elena.navarro@example.com',
    phone: '600 111 213',
    skills: ['typescript', 'node.js'],
  },
  { fullName: 'Javier Peña Duarte', email: 'javier.pena@example.com', skills: [] },
  {
    fullName: 'Sofía Arias Beltrán',
    email: 'sofia.arias@example.com',
    summary: 'Responsable de equipo con formación en gestión de proyectos.',
    skills: ['scrum', 'excel'],
  },
  {
    fullName: 'Adrián Molina Cano',
    email: 'adrian.molina@example.com',
    phone: '+34 600 111 216',
    skills: ['python', 'sql', 'aws'],
  },
  { fullName: 'Claudia Ramos Ortega', email: 'claudia.ramos@example.com', skills: ['ventas'] },
  {
    fullName: 'Iván Herrero Marín',
    email: 'ivan.herrero@example.com',
    summary: 'Desarrollador backend con experiencia en servicios de pago.',
    skills: ['java', 'sql', 'docker'],
  },
  {
    fullName: 'Alba Rivas Núñez',
    email: 'alba.rivas@example.com',
    phone: '600 111 219',
    skills: [],
  },
  {
    fullName: 'Pablo Castaño Luna',
    email: 'pablo.castano@example.com',
    skills: ['react', 'figma'],
  },
  {
    fullName: 'Noelia Santos Pardo',
    email: 'noelia.santos@example.com',
    summary: 'Administrativa contable, con manejo avanzado de hojas de cálculo.',
    skills: ['excel'],
  },
  {
    fullName: 'Gonzalo Vargas Mena',
    email: 'gonzalo.vargas@example.com',
    phone: '+34 600 111 222',
    skills: ['node.js', 'typescript', 'react', 'docker'],
  },
  {
    fullName: 'Inés Carrasco Roca',
    email: 'ines.carrasco@example.com',
    skills: ['scrum', 'ventas'],
  },
  { fullName: 'Tomás Escudero Gil', email: 'tomas.escudero@example.com', skills: ['aws'] },
  {
    fullName: 'Valeria Sáez Montoya',
    email: 'valeria.saez@example.com',
    phone: '600 111 225',
    summary: 'Perfil junior con prácticas en análisis de datos.',
    skills: ['python', 'sql'],
  },
  { fullName: 'Óscar Benítez Falcón', email: 'oscar.benitez@example.com', skills: [] },
  {
    fullName: 'Aitana Roldán Frías',
    email: 'aitana.roldan@example.com',
    skills: ['figma', 'react', 'typescript'],
  },
  {
    fullName: 'Marcos Duque Calvo',
    email: 'marcos.duque@example.com',
    phone: '+34 600 111 228',
    skills: ['java', 'scrum'],
  },
  {
    fullName: 'Rocío Bermejo Alonso',
    email: 'rocio.bermejo@example.com',
    skills: ['ventas', 'excel'],
  },
  {
    fullName: 'Samuel Ortiz Zamora',
    email: 'samuel.ortiz@example.com',
    summary: 'Técnico de soporte con ganas de pasar a desarrollo.',
    skills: ['docker'],
  },
];

type ConsentKind = 'current' | 'withdrawn' | 'none';

/**
 * Reparto 10 vigentes / 4 retirados / 16 sin consentimiento (RF-08): los índices múltiplos de 3 son vigentes, los
 * retirados son los 4 primeros índices que dejan resto 1 al dividir entre 6 (1, 7, 13 y 19).
 */
function consentKind(index: number): ConsentKind {
  if (index % 3 === 0) return 'current';
  if (index % 6 === 1 && index <= 19) return 'withdrawn';
  return 'none';
}

function toFields({ fullName, email, phone, summary, skills }: SeedCandidate): CandidateFields {
  return { fullName, email, phone: phone ?? null, summary: summary ?? null, skills };
}

/**
 * Inserta los 30 candidatos con el repositorio (DD-10). `createdAt = now - (3 + 5·i)` días, de 3 a 148: ninguno vencido
 * (alta + 6 meses ≥ 181 días). Se llama dentro de la transacción de `seed`. La retención sale de
 * `computeRetentionEndsAt` con `noCandidateProcesses`: el seed nunca crea inscripciones.
 */
export function seedCandidates(db: DatabaseSync, now: Date): void {
  const repository = createCandidatesRepository(db);
  SEED_CANDIDATES.forEach((candidate, index) => {
    const createdAt = new Date(now.getTime() - (3 + 5 * index) * DAY_MS).toISOString();
    const givenAt = new Date(Date.parse(createdAt) + DAY_MS).toISOString();
    const kind = consentKind(index);
    const given = kind === 'none' ? null : { givenAt, version: CONSENT_TEXT_VERSION };
    const id = repository.insert(toFields(candidate), createdAt, given);
    const withdrawnAt =
      kind === 'withdrawn' ? new Date(Date.parse(givenAt) + 2 * DAY_MS).toISOString() : null;
    if (withdrawnAt !== null) {
      repository.setConsent(id, { givenAt, version: CONSENT_TEXT_VERSION, withdrawnAt });
    }
    const retention = computeRetentionEndsAt({
      createdAt,
      consentGivenAt: given?.givenAt ?? null,
      consentWithdrawnAt: withdrawnAt,
      processes: noCandidateProcesses.getProcesses(id),
    });
    repository.setRetention(id, retention);
  });
}
