# TASK-06 — Seed de 40 inscripciones con su historial, y rendimiento

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-11; RF-10 con datos del seed; RNF-01, RNF-02)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
El seed de inscripciones (DT-05, DD-10), su test, el ajuste del test de retención del seed de candidatos y el test de
rendimiento.

1. **`apps/api/src/db/seed-candidates.ts`**: `seedCandidates` devuelve los IDs creados (`number[]`, en el orden de
   `SEED_CANDIDATES`); el resto igual.
2. **`apps/api/src/db/seed.ts`**: guarda los IDs de las 10 ofertas en el orden de `SEED_JOBS` y llama a
   `seedApplications` **en la misma transacción**, después de las ofertas y los candidatos.
3. **`apps/api/src/db/seed-applications.ts`**: `seedApplications(db, now, jobIds, candidateIds)` escribe
   **exactamente 40** inscripciones con `insertApplicationWithHistory` (TASK-03), cada una con su historial paso a paso:

   | Oferta (posición en `SEED_JOBS`) | Estado | N | Etapas (motivo) |
   |---|---|---|---|
   | Desarrollador/a backend (Node.js) (4) | `published` | 10 | 3 `received`, 2 `screening`, 2 `interview`, 1 `offer`, 1 `hired`, 1 `rejected` (`not_a_fit`, con nota) |
   | Administrativo/a contable (5) | `published` | 0 | — (estado vacío del pipeline) |
   | Técnico/a de selección de personal (6) | `published` | 10 | 2 `received`, 2 `screening`, 1 `interview`, 1 `offer`, 1 `hired`, 3 `rejected` (`candidate_withdrew`; `other` con nota; `not_a_fit`) |
   | Responsable de gestión de nóminas (7) | `published` | 10 | 2 `received`, 2 `screening`, 2 `interview`, 2 `offer`, 2 `rejected` (`other`, `candidate_withdrew`) |
   | Becario/a de marketing digital (8) | `closed` | 5 | 1 `hired`, 1 `rejected` (`not_a_fit`, antes del cierre), 3 `rejected` (`job_closed`, sin nota, en `2026-09-26T15:30:00.000Z`) |
   | Auxiliar de logística (9) | `closed` | 5 | 1 `hired`, 1 `rejected` (`other`, antes del cierre), 3 `rejected` (`job_closed`, sin nota, en `2026-09-15T16:00:00.000Z`) |
   | Borradores (0-3) | `draft` | 0 | — |

   - **Candidatos** (`i` = posición en `SEED_CANDIDATES`): las publicadas usan `i` = 1-20 (10 con dos inscripciones; al
     menos 3 con dos abiertas; uno con una sola inscripción y `rejected`, para EC-51); las cerradas, `i` = 25-29 (cada
     uno en las dos). `i` = 0 y 21-24 sin inscripciones.
   - **Fechas.** Publicadas: relativas al reset, todos los pasos en `(now − 90 h, now − 1 h]`, crecientes dentro de cada
     inscripción, después de la publicación de la oferta y del alta del candidato. Cerradas: ancladas a las fechas fijas
     de la oferta, entre su publicación y su cierre; los `job_closed`, justo en `closed_at` (INV-07).
   - **Notas** inventadas y no sensibles (p. ej., «Busca jornada parcial y la oferta es a jornada completa.»).
   - **Retención:** al final, para cada candidato inscrito, `recalculateRetention` de un `createCandidatesService` con
     `createCandidateProcessesReader` (con una abierta, `null`; con todas finales, la fórmula con `lastProcessClosedAt`).
     No se duplica la fórmula.
4. **Tests del seed** (dos ficheros hermanos, ≤ 300 líneas cada uno; base `:memory:` con `migrate` + `seed(db, NOW)` y
   `NOW` fijo):
   - `apps/api/test/applications/seed.test.ts`: «CA-25 40 inscripciones con la composición de DT-05» (por oferta: total,
     etapas y motivos; 0 en borradores y en la posición 5), «EC-54 las 6 etapas presentes en las publicadas y una
     publicada vacía», reparto de candidatos (10 con dos, ≥ 3 con dos abiertas, 25-29 en las dos cerradas), «EC-56
     notas inventadas de la lista del seed; candidatos `@example.com` y teléfonos `+34 600 000 0xx`», «EC-57 dos bases
     nuevas con migrate + seed(NOW) → mismos recuentos e invariantes».
   - `apps/api/test/applications/seed-invariants.test.ts`: INV-04 (cada historial es una cadena válida desde `NULL →
     received`), INV-05 (las cerradas solo con `hired` y `rejected`), INV-06 (`stage` = destino del último cambio,
     `last_change_at` = su fecha, `created_at` = la del inicial), INV-07 (`job_closed` solo en `closed_at` y sin nota),
     ventana de fechas de las publicadas, «retención de cada candidato = fórmula con el puerto real (null con una
     abierta)» y «EC-51 candidato con una única inscripción rejected → fecha calculada con lastProcessClosedAt».
5. **Test existente que cambia:** el último test de `apps/api/test/candidates/seed.test.ts` (`:98-113`, «RF-08 ninguno
   con la retención vencida…») compara con `createCandidateProcessesReader(createApplicationsRepository(db))` en lugar
   de `noCandidateProcesses` (`:110`, e import de `:7`) y admite `null` cuando el candidato tiene una inscripción
   abierta (`:103-104`). Ninguna otra línea.
6. **Rendimiento** `apps/api/test/applications/performance.test.ts`: «RNF-01 pipeline de 200 < 200 ms con 1 000
   candidatos y 2 000 inscripciones» y «RNF-02 POST < 500 ms» (`fastify.inject` sobre `:memory:`; datos preparados en
   una transacción con `insertApplicationWithHistory`).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/db/seed-applications.ts` | modificar | `seedApplications` (40 inscripciones y recálculo) |
| `apps/api/src/db/seed.ts` | modificar | IDs de las ofertas y llamada a `seedApplications` en la misma transacción |
| `apps/api/src/db/seed-candidates.ts` | modificar | `seedCandidates` devuelve `number[]` |
| `apps/api/test/applications/seed.test.ts` | crear | CA-25, EC-54, EC-56, EC-57 |
| `apps/api/test/applications/seed-invariants.test.ts` | crear | INV-04 a INV-07, retención, EC-51 |
| `apps/api/test/candidates/seed.test.ts` | modificar | Solo `:7` (import) y el último test, `:98-113` (`:103-104` y `:110`) |
| `apps/api/test/applications/performance.test.ts` | crear | RNF-01, RNF-02 |

## Implementa
- RF: RF-11, RF-10 (fecha con `lastProcessClosedAt`) · RNF: RNF-01, RNF-02 · CA: CA-25 · Edge cases: EC-51, EC-54,
  EC-55, EC-56, EC-57
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Migración de datos › Seed, DD-10, § Estrategia de tests (CA-25, RNF-01,
  RNF-02, «Tests que cambian»), § Checklist B-06

## Dependencias
- **Depende de:** TASK-03 (`insertApplicationWithHistory`, lector real), TASK-04 y TASK-05 (el rendimiento mide sus
  endpoints)
- **Bloquea:** TASK-09, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/api -- seed performance` en verde, con **7** ficheros de test (`applications/seed`,
      `applications/seed-invariants`, `candidates/seed`, `jobs/seed`, y los 3 `performance`).
- [ ] `npm run db:reset` dos veces seguidas sin errores, con 40 inscripciones cada vez.
- [ ] `npm test -w @ats/api` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/db/seed-applications.ts apps/api/src/db/seed.ts apps/api/src/db/seed-candidates.ts apps/api/test/applications/seed.test.ts apps/api/test/applications/seed-invariants.test.ts apps/api/test/candidates/seed.test.ts apps/api/test/applications/performance.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier. Si `seed-applications.ts` pasara, la tabla de datos va a
      un hermano `apps/api/src/db/seed-applications-data.ts`.
- [ ] Commit único `feat(api): seed 40 invented applications with step-by-step history [HU-04 TASK-06]` cuyo cuerpo
      cita `apps/api/test/candidates/seed.test.ts:7` y `:98-113`.

## Notas de implementación
- **DD-10:** las ofertas del seed tienen fechas fijas y los candidatos, relativas; por eso las cerradas se anclan a sus
  fechas y las publicadas, al `now` del reset. No cambies las fechas de `seed.ts` ni de `seed-candidates.ts`.
- `seedCandidates` corre **antes** que las inscripciones con `noCandidateProcesses`; `seedApplications` recalcula
  después con el puerto real. No cambies `noCandidateProcesses`.
- Los e2e existentes cuentan ofertas (10) y candidatos (≥ 30) y crean sus propios datos: el seed no cambia esas cifras
  ni toca borradores.
- Ventana de INV-05 (DT-10): el seed la respeta (solo `hired` y `rejected` en las cerradas).
- Rendimiento: varias repeticiones y el peor caso contra el umbral, como `apps/api/test/jobs/performance.test.ts`.
- Datos inventados siempre (RGPD §6.3).

## Reapertura · petición del responsable técnico (2026-10-07)
- **Origen:** comprobación del seed tras el commit `0c996f0`. La retención `null` coincide con «tiene alguna
  inscripción no final» (consulta sobre `data/ats.db`: 15 candidatos, IDs 2-10, 12, 13 y 17-20), pero el caso mixto (una
  inscripción final y otra abierta, IDs 6 y 10 de la base) solo está cubierto de forma implícita.
- **Qué hay que hacer:** en `apps/api/test/applications/seed-invariants.test.ts`, un test explícito: «RF-10 caso mixto:
  candidato con una inscripción final (`hired` o `rejected`) y otra abierta → retención `null`», que localice esos
  candidatos por consulta (sin IDs a mano), exija que haya al menos uno y compruebe `null` en cada uno. Corrige además el
  comentario del test de la línea ~225, que da los IDs en base 0 («candidatos 1-9, 11, 12 y 16-19»): o los pasa a los IDs
  reales de la base, o dice explícitamente que son índices del seed.
- **Ficheros:** `apps/api/test/applications/seed-invariants.test.ts`
- **Criterios de done:** `npm test -w @ats/api -- applications/seed` en verde; el fichero ≤ 300 líneas; eslint a 0.
- **Resultado (2026-10-07):** en verde (`npm test -w @ats/api -- applications/seed`: 2 files / 19 tests; eslint 0; 266 líneas). El test encuentra los candidatos 6 y 10 y el comentario usa los IDs reales de la base. Ciclo 0/2.

## Reapertura · review ronda 1 (curado) (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, curado de observaciones antes del merge), §9.
- **Qué hay que hacer:** Etiqueta de test: `apps/api/test/applications/seed.test.ts:188` se llama «EC-55» pero comprueba el reparto de candidatos; el EC-55 real lo cubre `seed-invariants.test.ts`. Corrige el nombre del test (p. ej. a «EC-54/RF-11 reparto de candidatos») sin cambiar sus aserciones.
- **Ficheros:** `apps/api/test/applications/seed.test.ts`
- **Criterios de done:** `npm test -w @ats/api -- applications/seed` en verde; eslint a 0.
