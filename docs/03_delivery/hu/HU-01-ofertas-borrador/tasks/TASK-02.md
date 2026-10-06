# TASK-02 — Tabla `job_openings` con sus restricciones [migration]

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** backend
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** M (1–2 h; estimada 1,5 h)

## Descripción
Crea la migración `001-create-job-openings.sql` con la tabla de ofertas, sus `CHECK` (RN-03, RN-04, INV-01, INV-04,
INV-05, INV-07) y el índice del listado. Añade a las utilidades de test `failWrites`, que simula un fallo real de
SQLite con un *trigger* (lo usarán los tests de EC-05, EC-22 y EC-29). Prueba que la base rechaza lo que está fuera de
dominio aunque se salte la API (EC-16, DD-08).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/db/migrations/001-create-job-openings.sql` | crear | Tabla `job_openings` e índice `job_openings_reference_date_idx` (SQL literal abajo) |
| `apps/api/test/helpers/test-app.ts` | modificar | Añade `failWrites(db, op)` |
| `apps/api/test/jobs/migration.test.ts` | crear | Tests de las restricciones de la base |

## Implementa
- RF: RF-07 (migración) · RF-02 (EC-16, categoría 5 «datos corruptos») · DD-07 (`AUTOINCREMENT`) · DD-08
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Migración de datos, DD-07, DD-08, § Estrategia de tests (`failWrites`)

## Dependencias
- **Depende de:** TASK-01 (`createTestApp`)
- **Bloquea:** TASK-03

## Criterios de done
- [ ] `migrate` aplica `001-create-job-openings.sql` sobre `:memory:` sin errores y lo registra en
      `schema_migrations`.
- [ ] Un `INSERT` directo con `salary_min > salary_max` lanza `CHECK constraint failed` (EC-16).
- [ ] La base rechaza estado, modalidad, salario (`0`, negativo, real `40000.5`), título (2 y 121 caracteres) y fecha
      (formato distinto de `YYYY-MM-DDTHH:MM:SS.mmmZ`) fuera de dominio, y acepta un borrador válido.
- [ ] La base rechaza `published` sin `published_at` y `published` sin descripción, ubicación o modalidad (DD-08).
- [ ] `failWrites(db, 'INSERT')` hace fallar el siguiente `INSERT` en `job_openings` con un error de SQLite.
- [ ] `npm run db:reset` termina sin errores e informa de 1 migración aplicada.
- [ ] `npm test -w apps/api -- migration health` en verde, con **2** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/test/helpers/test-app.ts apps/api/test/jobs/migration.test.ts` sin errores.
- [ ] Commit único `feat(api): create job_openings table [HU-01 TASK-02]` nombrando los ficheros.

## Notas de implementación

**SQL literal** (la aplica `apps/api/src/db/migrate.ts` dentro de su propia transacción: el fichero **no** lleva
`BEGIN`/`COMMIT`). Fichero en UTF-8 con la `í` de `híbrida` en **NFC** (un solo punto de código U+00ED).

```sql
-- HU-01: ofertas (JobOpening). Instantes en ISO 8601 UTC con milisegundos, como los da Date#toISOString().
CREATE TABLE job_openings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description  TEXT    CHECK (description IS NULL OR length(description) BETWEEN 1 AND 5000),
  location     TEXT    CHECK (location IS NULL OR length(location) BETWEEN 2 AND 120),
  work_mode    TEXT    CHECK (work_mode IS NULL OR work_mode IN ('presencial', 'híbrida', 'remota')),
  salary_min   INTEGER CHECK (salary_min IS NULL OR (typeof(salary_min) = 'integer' AND salary_min > 0)),
  salary_max   INTEGER CHECK (salary_max IS NULL OR (typeof(salary_max) = 'integer' AND salary_max > 0)),
  status       TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at   TEXT    NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  published_at TEXT    CHECK (published_at IS NULL OR published_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  closed_at    TEXT    CHECK (closed_at IS NULL OR closed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z'),
  CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),                 -- INV-07
  CHECK ((status = 'draft'     AND published_at IS NULL     AND closed_at IS NULL)
      OR (status = 'published' AND published_at IS NOT NULL AND closed_at IS NULL)
      OR (status = 'closed'    AND published_at IS NOT NULL AND closed_at IS NOT NULL)),          -- INV-01, INV-04, INV-05 (fechas)
  CHECK (status = 'draft' OR (description IS NOT NULL AND location IS NOT NULL AND work_mode IS NOT NULL)) -- INV-04
);

CREATE INDEX job_openings_reference_date_idx
  ON job_openings (COALESCE(published_at, created_at) DESC, id DESC);
```

- `typeof(...) = 'integer'` rechaza reales; el `GLOB` garantiza que ordenar por texto es cronológico.
- `AUTOINCREMENT` (DD-07): un ID borrado no se reutiliza (lo prueba TASK-05).
- No hay migraciones *down*: `npm run db:reset` regenera la base (DEC-03).
- Las transiciones de estado y «no borrar si no es `draft`» **no** van en la base (HU-02).

**`failWrites(db, op: 'INSERT' | 'UPDATE' | 'DELETE')`**: crea
`CREATE TRIGGER … BEFORE <op> ON job_openings BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END` (un nombre de *trigger*
por operación). Es un fallo real de SQLite, sin *mocks*.

**Tests** (`apps/api/test/jobs/migration.test.ts`, sobre `openDatabase(':memory:')` + `migrate`, con `INSERT`
directos y sentencias preparadas):
- «EC-16 la base rechaza mínimo > máximo».
- «la base rechaza estado, modalidad, salario, título y fecha fuera de dominio» (`it.each`) y un caso que acepta un
  borrador válido.
- «DD-08 la base rechaza published sin published_at o sin campos obligatorios».
- Un test de `failWrites` (el `INSERT` siguiente falla con `fallo simulado`).

Datos inventados («Analista de datos junior», «Sevilla»…), nunca personas reales.
