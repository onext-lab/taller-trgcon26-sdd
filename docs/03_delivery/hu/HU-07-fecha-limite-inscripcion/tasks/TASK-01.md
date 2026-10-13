# TASK-01 — La oferta guarda y devuelve su fecha límite (migración `004`) [migration]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-01; base de RF-02 a RF-05)
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
La rebanada de API más pequeña con valor propio: tras esta tarea, el reclutador **pone, cambia o quita** la fecha
límite de una oferta por la API (`POST /api/jobs`, `PATCH /api/jobs/:id`), la **lee** en el detalle (`GET
/api/jobs/:id`) y en todas las respuestas que devuelven un `Job`, y **duplicar no la copia**. Sin validación de día ni
de «no anterior a hoy» (TASK-02), sin 409 al inscribir (TASK-03) y sin web (TASK-06).

1. **Migración** `apps/api/src/db/migrations/004-add-job-enrollment-deadline.sql` (nueva; `001`-`003` no se tocan,
   DEC-03). Copia este SQL tal cual:

   ```sql
   -- HU-07: fecha límite de inscripción (FEAT-04 RN-01, RN-02). Día natural de Europe/Madrid 'AAAA-MM-DD', sin hora;
   -- NULL = sin límite. «No anterior a hoy» depende del reloj: lo valida el servicio, no la base.
   ALTER TABLE job_openings ADD COLUMN enrollment_deadline TEXT
     CHECK (enrollment_deadline IS NULL
         OR (enrollment_deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
             AND date(enrollment_deadline) IS enrollment_deadline));
   ```

   Las filas existentes quedan con `NULL` (sin plazo). Sin índice.
2. **Esquemas** (`apps/api/src/modules/jobs/schemas.ts`):
   - `Job`: `enrollmentDeadline: string | null` (tras `closedAt` o junto a los campos editables, a tu criterio, pero el
     mismo orden en `jobSchema.properties`).
   - `JobInput`: `enrollmentDeadline?: string | null` (`JobPatch` lo hereda).
   - `jobFieldsSchema`: `enrollmentDeadline: { type: ['string', 'null'], maxLength: 32 }` (DD-03: nada de `pattern` ni
     `format`; la validez la pondrá TASK-02 con el texto de DT-01).
   - `jobSchema`: `enrollmentDeadline: { type: ['string', 'null'] }` **y** en `required` (siempre presente, `null` si no
     hay plazo). `jobListItemSchema` **no** cambia (el listado no lleva la fecha).
3. **Repositorio** (`apps/api/src/modules/jobs/repository.ts`):
   - `JobRow`: `enrollment_deadline: string | null`; `toJob`: `enrollmentDeadline: row.enrollment_deadline`.
   - `INSERT_SQL` y `UPDATE_SQL`: la columna `enrollment_deadline` en la **lista fija** de columnas (DD-05 de HU-01:
     nunca un `SET` construido con las claves recibidas). `UPDATE_SQL` mantiene su `WHERE id = ? AND status IN
     ('draft', 'published')`.
   - `insert`: `input.enrollmentDeadline ?? null`; `update`: `fields.enrollmentDeadline`.
   - `JobEditableFields` pasa a **7 campos** con `enrollmentDeadline: string | null`.
   - `createJobWriteOperations` sube de ~43 a ~45 líneas de código: no añadas nada más dentro (umbral de 50).
4. **Ruta** (`apps/api/src/modules/jobs/routes.ts`): en `trimJobText`, `enrollmentDeadline` en `trim` y en
   `emptyToNull` (DEC-11.3: `""` o solo espacios → `null`, EC-03).
5. **Servicio** (`apps/api/src/modules/jobs/service.ts`):
   - `editableFields` devuelve también `enrollmentDeadline` (7 campos); así el `PATCH` lo fusiona como un campo más
     (ausente = no cambia; `null` = quitar el plazo) y gana la última escritura (DEC-08, EC-05).
   - `duplicate`: `repository.insert({ ...editableFields(original), enrollmentDeadline: null }, …)` — **explícito**
     (DD-05, RN-08). Actualiza el JSDoc de `duplicate` («los 6 campos editables» → «los campos editables, sin la fecha
     límite»).
   - `create` y `updateJob` no cambian en esta tarea (el campo viaja en `input`/`merged`).
6. **Tests**:
   - `apps/api/test/jobs/migration-deadline.test.ts` (**crear**), sobre `openDatabase(':memory:')` + `migrate`:
     - «RF-01 migrate aplica la 004 y la columna enrollment_deadline es opcional».
     - «Migración CHECK: 2026-10-13 y 2028-02-29 pasan; 2026-02-31, 2026-13-01, 2027-02-29, 13/10/2026 y
       " 2026-10-13" abortan» (`INSERT`/`UPDATE` directos con sentencias preparadas; `/CHECK constraint failed/`).
     - «EC-06 oferta previa a la migración: null, se publica y se inscribe». Para tener una oferta «previa»: ejecuta
       `schema.sql` y `001`-`003` a mano (lee los ficheros con `readFileSync`), registra los tres nombres en
       `schema_migrations`, inserta la oferta con `INSERT` directo y llama a `migrate(db)`, que debe devolver solo
       `['004-add-job-enrollment-deadline.sql']`. Después, `buildApp({ db, now })`: `GET` → `enrollmentDeadline: null`,
       `POST /:id/publish` → 200 y, con un candidato creado por la API, `POST /api/applications` → 201.
   - `apps/api/test/jobs/deadline.test.ts` (**crear**; TASK-02 lo amplía). Reloj `createTestClock('2026-10-13T10:00:00Z')`:
     - «CA-01 alta con 2026-10-13, con 2036-10-13 y sin fecha → 201 draft con la fecha o null» (y el `GET` igual).
     - «CA-03 published 2026-10-20 → 15/10, 30/11 y null: 200, mismo estado y fechas» (`status`, `createdAt`,
       `publishedAt` y `closedAt` iguales tras cada `PATCH`).
     - «EC-03 "" y espacios → null en alta y edición».
     - «EC-05 dos ediciones seguidas: gana la última».
   - `apps/api/test/jobs/deadline-publish-duplicate.test.ts` (**crear**; TASK-02 añade CA-07):
     - «CA-08 duplicar una con 2026-10-20 → borrador con null; la original igual».
7. **Tests existentes que cambian** (solo el dato nuevo; ninguna otra línea):
   - Los que comparan el `Job` entero: añade `enrollmentDeadline: null` donde la suite lo pida (previstos:
     `apps/api/test/jobs/create.test.ts`, `get.test.ts`, `publish.test.ts`, `duplicate.test.ts`,
     `state-guards.test.ts`; la lista exacta la da `npm test -w apps/api`).
   - **Hueco del TD-backend:** `apps/api/test/candidates/migration.test.ts:72-76` y
     `apps/api/test/applications/migration.test.ts:61-65` comparan con `toEqual` la lista **exacta** de migraciones:
     añade `'004-add-job-enrollment-deadline.sql'` al final de cada lista.
   - `apps/api/test/jobs/enumeration.test.ts` y el test de «campo desconocido» deben seguir en verde sin tocarlos (el
     esquema estricto admite ahora `enrollmentDeadline`, DEC-11).

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/api/src/db/migrations/004-add-job-enrollment-deadline.sql` | Crear | `ALTER TABLE … ADD COLUMN enrollment_deadline` con `CHECK` de día real |
| `apps/api/src/modules/jobs/schemas.ts` | Modificar | `enrollmentDeadline` en `Job`, `JobInput`, `jobFieldsSchema` y `jobSchema` (`required`) |
| `apps/api/src/modules/jobs/repository.ts` | Modificar | `JobRow`, `toJob`, `INSERT_SQL`, `UPDATE_SQL`, `insert`, `update`, `JobEditableFields` (7) |
| `apps/api/src/modules/jobs/routes.ts` | Modificar | `enrollmentDeadline` en `trim` y `emptyToNull` de `trimJobText` |
| `apps/api/src/modules/jobs/service.ts` | Modificar | `editableFields` (7) y `duplicate` con `enrollmentDeadline: null` |
| `apps/api/test/jobs/migration-deadline.test.ts` | Crear | Columna, `CHECK` y EC-06 |
| `apps/api/test/jobs/deadline.test.ts` | Crear | CA-01 (sin validación), CA-03, EC-03, EC-05 |
| `apps/api/test/jobs/deadline-publish-duplicate.test.ts` | Crear | CA-08 |
| `apps/api/test/jobs/{create,get,publish,duplicate,state-guards}.test.ts` | Modificar | `enrollmentDeadline: null` donde comparan el `Job` entero |
| `apps/api/test/candidates/migration.test.ts` | Modificar | Líneas 72-76: la `004` en la lista de migraciones |
| `apps/api/test/applications/migration.test.ts` | Modificar | Líneas 61-65: la `004` en la lista de migraciones |

## Implementa
- RF: RF-01 (campo, alta, edición, detalle, duplicar; **sin** reglas de día ni de publicar) · RF-06 (parte API: la
  oferta devuelve la fecha) · CA: CA-01 (parte sin validación), CA-03, CA-08 · Edge cases: EC-03, EC-05, EC-06, EC-18
  y EC-21 (parte API)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API («El campo»), § Migración de datos, § Módulos y ficheros
  afectados, DD-01, DD-05, § Checklist de implementación (punto 2, parte de `jobs`)

## Dependencias
- **Depende de:** nada
- **Bloquea:** TASK-02

## Criterios de done
- [ ] `npm test -w apps/api -- jobs/migration-deadline jobs/deadline` en verde, con **3** ficheros de test
      (`migration-deadline`, `deadline`, `deadline-publish-duplicate`).
- [ ] `npm test -w apps/api` completo en verde (cascada de `Job` y listas de migraciones arreglada).
- [ ] `npm run db:reset` aplica `001`-`004` y el seed sin errores.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/jobs/schemas.ts apps/api/src/modules/jobs/repository.ts apps/api/src/modules/jobs/routes.ts apps/api/src/modules/jobs/service.ts apps/api/test/jobs/migration-deadline.test.ts apps/api/test/jobs/deadline.test.ts apps/api/test/jobs/deadline-publish-duplicate.test.ts`
      sin errores (más los tests existentes que toques).
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `feat(api): add optional enrollment deadline to job openings (migration 004) [HU-07 TASK-01]`.

## Notas de implementación
- **Estado intermedio consciente:** hasta TASK-02, la API acepta cualquier día real, también pasado, y un texto que no
  es un día (`2026-02-31`, `13/10/2026`) lo para el `CHECK` como **500**. No escribas tests de eso aquí: TASK-02 lo
  convierte en 400 con el texto de DT-01 y TASK-05 lo ataca.
- `date()` normaliza los días imposibles (`date('2026-02-31')` = `2026-03-03`, `date('2026-13-01')` = `NULL`): por eso
  el `CHECK` compara con `IS`. Comprobado en Node 24.21 (SQLite 3.53.4).
- Las ofertas de los tests se crean por la API con el reloj inyectado (DD-12); el `UPDATE` por SQL solo en
  `migration-deadline.test.ts`.
- El `PATCH` sigue `minProperties: 1`: `{ enrollmentDeadline: null }` es un cuerpo válido.
- `docs/ARCHITECTURE.md` (fila «Base de datos», migración `004`) lo actualiza TASK-04, junto al seed.
- Datos inventados; ningún dato personal nuevo.
