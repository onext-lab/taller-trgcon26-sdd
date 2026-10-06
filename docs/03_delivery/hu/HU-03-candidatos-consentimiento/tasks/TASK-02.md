# TASK-02 — Tabla de candidatos, puerto de procesos y fórmula de retención [migration]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-07; base de RF-08 y de todo el módulo)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Nace el módulo `candidates` con sus piezas sin HTTP:
1. **Migración** `apps/api/src/db/migrations/002-create-candidates.sql` (la siguiente libre; la `001` es de ofertas):
   tabla `candidates` con sus `CHECK`, el índice único del email y el índice del orden del listado.
2. **Puerto de procesos** `processes-port.ts`: `CandidateProcesses`, `CandidateProcessesPort` (síncrono) y el *stub*
   `noCandidateProcesses` (`{ hasOpenApplication: false, hadAnyApplication: false, lastProcessClosedAt: null }`). Lo
   implementará `inscripciones` en HU-04 sin cambiar la firma (DEC-06).
3. **Fórmula pura** `retention.ts`: `madridCalendarDate`, `addMonthsClamped` y `computeRetentionEndsAt`, sin reloj ni
   base. Es la **única** fórmula de retención del sistema (RN-07, RGPD §3).

Sin rutas, sin servicio y sin cambios en `app.ts` (los conecta TASK-03).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/db/migrations/002-create-candidates.sql` | crear | Tabla, `CHECK`, `candidates_email_uq`, `candidates_created_at_idx` |
| `apps/api/src/modules/candidates/processes-port.ts` | crear | `CandidateProcesses`, `CandidateProcessesPort`, `noCandidateProcesses` |
| `apps/api/src/modules/candidates/retention.ts` | crear | `madridCalendarDate`, `addMonthsClamped`, `computeRetentionEndsAt` (puras) |
| `apps/api/test/candidates/migration.test.ts` | crear | EC-16, EC-47 e índice único |
| `apps/api/test/candidates/retention.test.ts` | crear | CA-02, CA-31 (filas de RGPD §3), EC-44, EC-51, EC-52, EC-55, EC-57 (pura) |

## Implementa
- RF: RF-07 (fórmula y puerto) · base de RF-08 · CA: CA-02, CA-31 (parte fórmula) · Edge cases: EC-16, EC-44 (recorte
  de mes), EC-47, EC-51, EC-52, EC-55, EC-57 (pura)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Migración de datos, § Firmas internas (`processes-port.ts`,
  `retention.ts`), DD-01, DD-05, DD-06, § Checklist B-02

## Dependencias
- **Depende de:** TASK-01 (orden fijado por el aprobador: B-01 va primero; no comparten ficheros)
- **Bloquea:** TASK-03

## Criterios de done
- [ ] `migrate` sobre `:memory:` aplica `001` y `002` sin errores; `npm run db:reset` termina sin errores.
- [ ] `INSERT` crudo con email en mayúsculas o con espacios → error `CHECK` (INV-02, EC-16).
- [ ] `INSERT` crudo con versión sin fecha de otorgamiento, o con fecha de retirada sin otorgamiento → error `CHECK`
      (INV-04, EC-16, EC-47).
- [ ] Dos `INSERT` con el mismo email → error `UNIQUE` sobre `candidates.email` (`errcode` 2067).
- [ ] `skills` que no es JSON, no es array o tiene 21 elementos → error `CHECK`.
- [ ] CA-02 / EC-51: altas 2026-10-06T22:30:00Z → 2027-04-07; 2026-08-31 → 2027-02-28; 2027-08-31 → 2028-02-29;
      2026-10-25T00:30:00Z (cambio de hora) → 2027-04-25; 2026-03-31 → 2026-09-30.
- [ ] EC-44: `addMonthsClamped('2028-02-29', 24)` → `2030-02-28`.
- [ ] CA-31: cada fila de `docs/RGPD.md` §3 (inscripción abierta → `null`; proceso cerrado sin consentimiento →
      cierre + 6; consentimiento vigente → consentimiento + 24; sin inscripciones ni consentimiento → alta + 6).
- [ ] EC-52: consentimiento vigente 2025-01-10 y cierre 2026-09-15 → `2027-03-15` (la más tardía).
- [ ] EC-55: inscripción abierta y cierre anterior con consentimiento retirado → `null`; el retirado no cuenta.
- [ ] Puerto incoherente (`hadAnyApplication: true`, `hasOpenApplication: false`, `lastProcessClosedAt: null`, sin
      consentimiento vigente y con inscripciones) → `computeRetentionEndsAt` lanza `Error`.
- [ ] EC-57: dos llamadas con los mismos datos → misma fecha.
- [ ] `npm test -w @ats/api -- candidates/migration candidates/retention` en verde, con **2** ficheros de test.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/candidates/processes-port.ts apps/api/src/modules/candidates/retention.ts apps/api/test/candidates/migration.test.ts apps/api/test/candidates/retention.test.ts`
      sin errores.
- [ ] Commit único `feat(api): candidates table, processes port and retention formula [HU-03 TASK-02]` nombrando los
      ficheros.

## Notas de implementación

**Tabla `candidates`** (sin trigger ni `ON DELETE`: no hay borrado, INV-05):

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | — |
| `full_name` | `TEXT NOT NULL` | `length` 2-100 |
| `email` | `TEXT NOT NULL` | `length` 3-254 y `email = lower(trim(email))` (INV-02) |
| `phone` | `TEXT` | nulo o `length` 6-21 |
| `summary` | `TEXT` | nulo o `length` 1-2000 |
| `skills` | `TEXT NOT NULL DEFAULT '[]'` | `json_valid(skills) AND json_type(skills) = 'array' AND json_array_length(skills) <= 20` |
| `created_at` | `TEXT NOT NULL` | `GLOB` ISO con ms (copiar el de `001`) |
| `consent_given_at` · `consent_withdrawn_at` | `TEXT` | nulo o `GLOB` ISO con ms |
| `consent_version` | `TEXT` | nulo o `GLOB 'v[0-9]*'` |
| `retention_ends_at` | `TEXT` | nulo o `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'` (admite `NULL` ya: HU-04 no migra) |

- `CHECK ((consent_given_at IS NULL) = (consent_version IS NULL))` y
  `CHECK (consent_withdrawn_at IS NULL OR consent_given_at IS NOT NULL)` (INV-04).
- `CREATE UNIQUE INDEX candidates_email_uq ON candidates (email)` (INV-01, DEC-08).
- `CREATE INDEX candidates_created_at_idx ON candidates (created_at DESC, id DESC)`.

**Firmas** (TD-backend § Firmas internas):

```ts
// processes-port.ts
export interface CandidateProcesses {
  hasOpenApplication: boolean;          // ¿alguna inscripción en etapa no final?
  hadAnyApplication: boolean;           // ¿tuvo alguna vez?
  lastProcessClosedAt: string | null;   // ISO UTC; no nulo si hadAnyApplication && !hasOpenApplication
}
export interface CandidateProcessesPort { getProcesses(candidateId: number): CandidateProcesses }
export const noCandidateProcesses: CandidateProcessesPort;

// retention.ts
export function madridCalendarDate(instant: string): string;            // Intl, timeZone 'Europe/Madrid' → 'AAAA-MM-DD'
export function addMonthsClamped(date: string, months: number): string; // último día del mes si no existe
export function computeRetentionEndsAt(facts: {
  createdAt: string; consentGivenAt: string | null; consentWithdrawnAt: string | null; processes: CandidateProcesses;
}): string | null;
```

- `computeRetentionEndsAt`: abierta → `null`; si no, el **máximo** de los plazos aplicables: consentimiento vigente
  (otorgado y no retirado) + 24 meses; cierre del último proceso + 6; alta + 6 si nunca tuvo inscripciones. Si no
  aplica ninguno (puerto que incumple su contrato) lanza `Error` → 500 y `ROLLBACK` en quien la invoque (EC-53, en
  TASK-06 y TASK-08).
- Las fechas de partida son el día natural en Europe/Madrid del instante UTC guardado (DEC-09).
- `candidates` no importa nada de `jobs` ni de `applications` (DEC-06).
- Riesgo heredado: `Intl` con ICU reducido. Node 24 trae ICU completo; el caso del cambio de hora lo vigila.
