# TASK-01 — Migración `003`: inscripciones e historial inmutable, y aclaración de DEC-06 [migration]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-02; base de RF-01 a RF-05 y RF-11)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Primera tarea de la HU: crea las tablas de `inscripciones` con todas las invariantes que puede defender la base, sus
tests, el ajuste del único test existente que lista las migraciones y la aclaración de DEC-06. Pasos:

1. **Migración** `apps/api/src/db/migrations/003-create-applications.sql` (nueva; `001` y `002` no se tocan, DEC-03).
   Copia este SQL tal cual. `ISO` es el mismo `GLOB` de `002-create-candidates.sql`:
   `'[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'`.

   ```sql
   -- HU-04: inscripciones (Application) e historial (StageChange). Dueño: applications (DEC-06). Las FK a candidates y
   -- job_openings son integridad referencial de la base, no acoplamiento de código (aclaración de DEC-06).
   CREATE TABLE applications (
     id             INTEGER PRIMARY KEY AUTOINCREMENT,
     candidate_id   INTEGER NOT NULL REFERENCES candidates (id) ON DELETE RESTRICT,
     job_id         INTEGER NOT NULL REFERENCES job_openings (id) ON DELETE RESTRICT,
     stage          TEXT    NOT NULL CHECK (stage IN ('received','screening','interview','offer','hired','rejected')),
     created_at     TEXT    NOT NULL CHECK (created_at GLOB ISO),
     last_change_at TEXT    NOT NULL CHECK (last_change_at GLOB ISO),
     CHECK (last_change_at >= created_at)
   );
   CREATE UNIQUE INDEX applications_candidate_job_uq ON applications (candidate_id, job_id);  -- INV-01, DEC-08
   CREATE INDEX applications_job_pipeline_idx ON applications (job_id, last_change_at DESC, id DESC);

   CREATE TABLE stage_changes (
     id             INTEGER PRIMARY KEY AUTOINCREMENT,
     application_id INTEGER NOT NULL REFERENCES applications (id) ON DELETE RESTRICT,
     from_stage     TEXT,
     to_stage       TEXT    NOT NULL,
     changed_at     TEXT    NOT NULL CHECK (changed_at GLOB ISO),
     reason         TEXT    CHECK (reason IS NULL OR reason IN ('not_a_fit','candidate_withdrew','other','job_closed')),
     note           TEXT    CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),                -- INV-10
     CHECK ((from_stage IS NULL AND to_stage = 'received')
         OR (from_stage IS 'received'  AND to_stage IN ('screening','rejected'))
         OR (from_stage IS 'screening' AND to_stage IN ('interview','rejected'))
         OR (from_stage IS 'interview' AND to_stage IN ('offer','rejected'))
         OR (from_stage IS 'offer'     AND to_stage IN ('hired','rejected'))),                   -- INV-04, EC-13
     CHECK ((reason IS NOT NULL) = (to_stage = 'rejected')),                                      -- INV-07
     CHECK (note IS NULL OR to_stage = 'rejected')                                                -- INV-10
   );
   CREATE INDEX stage_changes_application_idx ON stage_changes (application_id, id);
   CREATE UNIQUE INDEX stage_changes_one_initial_uq ON stage_changes (application_id) WHERE from_stage IS NULL;
   CREATE UNIQUE INDEX stage_changes_one_final_uq ON stage_changes (application_id) WHERE to_stage IN ('hired','rejected');

   -- INV-03: los únicos triggers del esquema (DT-07). Única excepción, RGPD §5 (anonimizar el texto libre):
   -- UPDATE stage_changes SET note = NULL. Cualquier otro cambio de columna, o una nota distinta de NULL, aborta.
   CREATE TRIGGER stage_changes_no_update BEFORE UPDATE ON stage_changes
   WHEN NEW.id IS NOT OLD.id
     OR NEW.application_id IS NOT OLD.application_id
     OR NEW.from_stage IS NOT OLD.from_stage
     OR NEW.to_stage IS NOT OLD.to_stage
     OR NEW.changed_at IS NOT OLD.changed_at
     OR NEW.reason IS NOT OLD.reason
     OR NEW.note IS NOT NULL
   BEGIN SELECT RAISE(ABORT, 'stage_changes es inmutable'); END;
   CREATE TRIGGER stage_changes_no_delete BEFORE DELETE ON stage_changes
   BEGIN SELECT RAISE(ABORT, 'stage_changes es inmutable'); END;
   ```

2. **Tests de la migración**, en dos ficheros hermanos para no pasar de 300 líneas (regla del aprobador). Base
   `:memory:` con `openDatabase` + `migrate`; la oferta y el candidato de los *fixtures*, por `INSERT` directo con
   columnas explícitas (o con `createTestApp` + `createPublishedJob` / `createCandidate`); la inscripción y sus
   `StageChange`, por `INSERT` directo (el repositorio llega en TASK-03).
   - `apps/api/test/applications/migration.test.ts`:
     - «RF-02 migrate aplica 001, 002 y 003 sobre :memory:, las registra y crea tablas, índices y los 2 triggers»
       (nombres exactos de los 5 índices; en `sqlite_master` **solo** los triggers `stage_changes_no_update` y
       `stage_changes_no_delete`, DT-07).
     - «EC-16 un segundo migrate devuelve []».
     - «EC-12 etapa `foo`, motivo en un `screening` y nota de 501 caracteres → error de `CHECK`».
     - «EC-13 (NULL, received) se acepta; (NULL, screening) falla el `CHECK`».
   - `apps/api/test/applications/migration-triggers.test.ts` (fixture: inscripción `rejected` con `NULL → received` y
     `received → rejected` con motivo `not_a_fit` y nota):
     - «CA-27 UPDATE directo de `to_stage` y DELETE directo sobre stage_changes → abortan y la fila no cambia».
     - «RGPD §5 SET note = NULL en un rejected con nota → se vacía y el resto de la fila no cambia».
     - «RGPD §5 note a otro texto → aborta y la fila no cambia».
     - «RGPD §5 note = NULL junto a otra columna → aborta y la fila no cambia».
     - `it.each` sobre `id`, `application_id`, `from_stage`, `to_stage`, `changed_at` y `reason`: «RGPD §5 UPDATE de
       {columna} → aborta y la fila no cambia».
     - «RGPD §5 DELETE sigue abortando también tras vaciar la nota».
3. **Test existente que cambia:** `apps/api/test/candidates/migration.test.ts:73`: la lista esperada pasa a
   `['001-create-job-openings.sql', '002-create-candidates.sql', '003-create-applications.sql']`. Ninguna otra línea.
4. **Aclaración de DEC-06** en `docs/07_architecture_principles/DECISIONS.md` (texto del TD-backend, § Impacto en
   decisiones). Sustituye la viñeta «Dirección de dependencias, sin ciclos…» (líneas 98-99) por estas dos, **literales**:

   > - Dirección de dependencias, sin ciclos: `ofertas → inscripciones → candidatos` es la dirección de las llamadas que
   >   compone `apps/api/src/app.ts`; los puertos los implementa el módulo de la izquierda y se conectan allí. **Ningún
   >   módulo importa a otro**, tampoco sus tipos: la implementación cumple el puerto por tipado estructural y `app.ts`
   >   lo comprueba al conectarla.
   > - **Las claves foráneas entre tablas de módulos distintos son integridad referencial de la base, no un acoplamiento
   >   de código.** Las declara la migración del módulo dueño de la tabla que referencia (p. ej.,
   >   `003-create-applications.sql`: `applications.candidate_id → candidates.id` y `applications.job_id →
   >   job_openings.id`, con `ON DELETE RESTRICT`) y no autorizan a ningún módulo a consultar ni escribir con SQL las
   >   tablas de otro.

   Y añade al final de su *Estado* (línea 105): «; aclarada en el diseño de HU-04 (claves foráneas entre módulos;
   ningún módulo importa a otro)». No hace falta un `DEC-NN` nuevo.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/db/migrations/003-create-applications.sql` | crear | Tablas, índices, `CHECK`, FK `RESTRICT` y los 2 triggers |
| `apps/api/test/applications/migration.test.ts` | crear | Estructura, EC-12, EC-13, EC-16 |
| `apps/api/test/applications/migration-triggers.test.ts` | crear | CA-27, EC-15 (triggers) y la excepción RGPD §5 |
| `apps/api/test/candidates/migration.test.ts` | modificar | Solo la línea 73 (lista de migraciones con la `003`) |
| `docs/07_architecture_principles/DECISIONS.md` | modificar | DEC-06: viñeta de las líneas 98-99 → las dos de arriba; *Estado* (línea 105) |

## Implementa
- RF: RF-02 · CA: CA-27 · Edge cases: EC-12, EC-13, EC-15 (triggers), EC-16 · DD-04 (excepción RGPD §5)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Migración de datos, DD-04, DD-05, § Impacto en decisiones (aclaración de
  DEC-06), § Estrategia de tests (CA-27, DD-04), § Checklist B-01

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-03

## Criterios de done
- [ ] `npm test -w @ats/api -- applications/migration` en verde, con **2** ficheros de test.
- [ ] `npm test -w @ats/api -- candidates/migration jobs/migration` en verde (2 ficheros; solo cambia
      `candidates/migration.test.ts:73`).
- [ ] Vaciar la nota (`SET note = NULL`) funciona; cualquier otro `UPDATE` (cada columna, nota a otro texto, nota a
      `NULL` junto a otra columna) y el `DELETE` abortan con `stage_changes es inmutable` y dejan la fila igual.
- [ ] `npm run db:reset` aplica `001`-`003` y el seed sin errores.
- [ ] `DECISIONS.md`: DEC-06 con las dos viñetas literales y la frase añadida a *Estado*.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/applications/migration.test.ts apps/api/test/applications/migration-triggers.test.ts apps/api/test/candidates/migration.test.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `feat(api): add applications and stage_changes tables (migration 003) [HU-04 TASK-01]` cuyo cuerpo
      cita `apps/api/test/candidates/migration.test.ts:73`.

## Notas de implementación
- **`IS` y no `=`** en el `CHECK` de transiciones (comprobado en SQLite): con `=`, la fila `(NULL, 'screening')` da
  `NULL` en un término y un `CHECK` que vale `NULL` **se acepta**. EC-13 lo fija.
- Los triggers son `BEFORE`: se disparan antes que los `CHECK` y las FK. En los tests de RGPD §5, comprueba el mensaje
  (`/stage_changes es inmutable/`) para saber que aborta el trigger y no otra restricción; y relee la fila completa
  para comprobar que no cambió.
- Nada exige nota en un `rejected` (es opcional, RN-05): vaciarla no choca con ningún `CHECK`.
- `PRAGMA foreign_keys = ON` ya lo pone `apps/api/src/db/connection.ts`; las FK `RESTRICT` las prueba TASK-09.
- Los triggers `fail_*` de `failWrites` (`apps/api/test/helpers/test-app.ts`) son *fixtures* de test: la aserción
  «solo 2 triggers» se hace sobre una base recién migrada, sin `failWrites`.
- Datos inventados (`@example.com`, teléfonos `+34 600 000 0xx`); notas sin datos sensibles.
- `/module-sync` documentará el esquema en `docs/05_modules/inscripciones/` (no es de esta tarea).

## Nota · gate de tareas (2026-10-07)
El aprobador exige que `apps/api/test/applications/migration-triggers.test.ts` cubra los **14 casos** que el diseño
verificó en SQLite, no solo los de la lista anterior. Además de esos, añade:
- se aceptan: repetir `SET note = NULL` con la nota ya `NULL`, y `SET note = NULL` sobre el cambio inicial
  (`NULL → received`);
- abortan: `reason` a `NULL` en un `rejected`, y cambiar `from_stage` del cambio inicial.
Mínimo exigido: (a) `SET note = NULL` pasa; (b) `SET note = NULL` más otra columna en el mismo `UPDATE` aborta; (c) la
nota a otro texto aborta; (d) `DELETE` aborta. En cada caso que aborta, la fila no cambia.
