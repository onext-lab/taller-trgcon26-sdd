# TASK-04 — El pipeline dice si el plazo venció, y el seed trae ofertas con plazo

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** backend
- **Capa:** api
- **Estado:** Completada
- **Prioridad:** Must (RF-04, parte API) · Should (RF-05)
- **Complejidad:** L (2–4 h; estimada 2,5 h)

## Descripción
Lo que la web necesita para pintar una oferta con el plazo vencido, con datos reales que enseñar: el `job` del
pipeline trae la fecha y un booleano **calculado con el reloj del servidor** (DD-08), y el seed deja una oferta
publicada con plazo futuro y otra con el plazo vencido, relativas al día del reset (DD-11).

1. **Contrato del pipeline** (`apps/api/src/modules/applications/schemas.ts`): `Pipeline.job` y
   `pipelineSchema.properties.job` (`additionalProperties: false`, los cuatro en `required`):

   ```ts
   job: {
     id: number;
     status: 'draft' | 'published' | 'closed';
     enrollmentDeadline: string | null;   // 'AAAA-MM-DD' o null
     enrollmentDeadlinePassed: boolean;   // hay plazo y hoy (Europe/Madrid, reloj del servidor) es posterior
   }
   ```

   En el esquema: `enrollmentDeadline: { type: ['string', 'null'] }`, `enrollmentDeadlinePassed: { type: 'boolean' }`.
2. **Servicio** (`apps/api/src/modules/applications/service.ts`), `getPipeline`: `getJobStatus` (404) →
   `getEnrollmentDeadline` → `listByJob` → `findNames` → `today = madridCalendarDate(now().toISOString())` →
   `{ job: { id, status, enrollmentDeadline, enrollmentDeadlinePassed: isDeadlinePassed(deadline, today) }, items }`.
   Sin transacción, como hoy (DD-07 de HU-05). `enrollmentDeadlinePassed` es un **hecho independiente del estado**:
   también `true` en `draft` y `closed` (la web mira antes `status`, EC-28).
3. **Seed** (`apps/api/src/db/seed.ts`): `SeedJob` gana `enrollmentDeadlineInDays?: number`; en `seed()`,
   `enrollmentDeadline = addCalendarDays(madridCalendarDate(now.toISOString()), offset)` y se pasa en el `JobInput` de
   `repository.insert` (el seed escribe por el repositorio, no por el servicio: no aplica RN-03).

   | Oferta (por título) | Inscripciones | `enrollmentDeadlineInDays` | Con `now` = 2026-10-13 |
   |---|---|---|---|
   | «Desarrollador/a backend (Node.js)» (5.ª de `SEED_JOBS`) | 10 | `+14` | `2026-10-27` |
   | «Administrativo/a contable» (6.ª de `SEED_JOBS`) | 0 | `-3` | `2026-10-10` (vencido) |
   | Resto | — | sin plazo | `null` |

   El vencido va en la publicada **sin** inscripciones: con inscripciones quedarían algunas creadas después del plazo
   (rompería INV-01 de FEAT-04).
4. **Docs** (`docs/ARCHITECTURE.md`): fila «Base de datos» (línea 29) con `004-add-job-enrollment-deadline.sql` y el
   seed «(dos publicadas con plazo relativo al reset)»; fila de `JobStatusPort` (línea 54) «estado, resumen y fecha
   límite de una oferta (HU-07)».
5. **Tests**:
   - `apps/api/test/applications/pipeline-deadline.test.ts` (**crear**):
     - «CA-12 published vencida con y sin inscripciones → job con la fecha y enrollmentDeadlinePassed true; items
       iguales; avanzar y rechazar 200» (RN-10).
     - «CA-06 tras ampliar, enrollmentDeadlinePassed false».
     - «EC-25 plazo hoy → false; ayer → true, también con items: []».
     - «EC-27 pipeline a las 23:59 false, inscribir a las 00:00 → 409, pipeline → true».
     - «EC-28 closed con plazo vencido → status closed y enrollmentDeadlinePassed true».
     - «EC-30 dos lecturas iguales».
   - `apps/api/test/jobs/seed-deadlines.test.ts` (**crear**): «CA-13 seed(NOW): una publicada con plazo NOW+14 y otra
     con NOW−3, sin inscripciones posteriores al plazo», repetido con otro `NOW` (fechas desplazadas).
   - **Cascada** (solo el dato nuevo): `apps/api/test/applications/pipeline.test.ts:143`, `:187`, `:203`;
     `apps/api/test/applications/pipeline-adversarial.test.ts:123`; `apps/api/test/applications/seed.test.ts:175`
     (`enrollmentDeadline` y `enrollmentDeadlinePassed` en `job`). En `seed.test.ts:175` la oferta vacía es
     `jobIds(appDb)[5]`, «Administrativo/a contable»: con el `NOW` del test queda `enrollmentDeadline` = día de Madrid
     de `NOW` − 3 y `enrollmentDeadlinePassed: true`. Si `apps/api/test/jobs/seed.test.ts` compara el `Job` entero,
     añade la fecha.

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/api/src/modules/applications/schemas.ts` | Modificar | `Pipeline.job` y `pipelineSchema` con los dos campos (`required`) |
| `apps/api/src/modules/applications/service.ts` | Modificar | `getPipeline` con la fecha y el booleano del servidor |
| `apps/api/src/db/seed.ts` | Modificar | `enrollmentDeadlineInDays?` y cálculo relativo a `now` |
| `docs/ARCHITECTURE.md` | Modificar | Filas «Base de datos» y `JobStatusPort` |
| `apps/api/test/applications/pipeline-deadline.test.ts` | Crear | CA-06, CA-12, EC-25, EC-27, EC-28, EC-30 |
| `apps/api/test/jobs/seed-deadlines.test.ts` | Crear | CA-13 |
| `apps/api/test/applications/pipeline.test.ts` | Modificar | Líneas 143, 187 y 203: `job` con los dos campos |
| `apps/api/test/applications/pipeline-adversarial.test.ts` | Modificar | Línea 123 |
| `apps/api/test/applications/seed.test.ts` | Modificar | Línea 175 |

## Implementa
- RF: RF-04 (parte API: contrato S4 del TD-frontend) · RF-05 · CA: CA-06 (pipeline), CA-12 (API), CA-13 · Edge cases:
  EC-25, EC-27, EC-28, EC-30 (parte API)
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Contrato de API (`Pipeline.job`), § Diagrama de secuencia (párrafo
  «Pipeline»), § Migración de datos (seed), DD-08, DD-11, § Checklist de implementación (puntos 5, parte de pipeline,
  y 6)

## Dependencias
- **Depende de:** TASK-03 (`getEnrollmentDeadline` en el puerto)
- **Bloquea:** TASK-07, TASK-09

## Criterios de done
- [ ] `npm test -w apps/api -- applications/pipeline jobs/seed applications/seed` en verde (incluye
      `pipeline-deadline` y `seed-deadlines`).
- [ ] `npm test -w apps/api` completo en verde.
- [ ] `npm run db:reset` sin errores.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/modules/applications/schemas.ts apps/api/src/modules/applications/service.ts apps/api/src/db/seed.ts apps/api/test/applications/pipeline-deadline.test.ts apps/api/test/jobs/seed-deadlines.test.ts apps/api/test/applications/pipeline.test.ts apps/api/test/applications/pipeline-adversarial.test.ts apps/api/test/applications/seed.test.ts`
      sin errores.
- [ ] Ningún fichero pasa de 300 líneas (`applications/service.ts` y `schemas.ts` quedan en ~265 y ~240).
- [ ] Commit único `feat(api): expose enrollment deadline in the pipeline and seed deadlines [HU-07 TASK-04]`.

## Notas de implementación
- Si la base se usa más de 14 días después del reset, las dos ofertas quedan vencidas: se regenera con
  `npm run db:reset`; los e2e regeneran `data/e2e.db` en cada pasada (DEC-03).
- Las inscripciones del seed de las publicadas caen en las últimas 90 h (`seed-applications.ts`): con `+14` en la
  «backend», ninguna es posterior al plazo.
- Los e2e existentes crean sus propias ofertas por la API (`createJobByApi`), así que el seed nuevo no debería
  cambiarlos; `npm run e2e` completo lo confirma en TASK-09.
