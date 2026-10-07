# TASK-02 — Puerto real conectado en `buildApp`: cierre con rechazo y recuento de punta a punta

## Metadata
- **HU:** HU-06 · **Feature:** FEAT-03
- **Scope:** backend
- **Capa:** api
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02, RF-03)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Conecta la implementación real de TASK-01 a `jobs` y prueba el cierre y la previa por la API. Sin cambios de contrato
HTTP ni en `apps/api/src/modules/jobs/{service,repository,routes,schemas}.ts`.

1. **Composición** (`apps/api/src/app.ts`, DD-06). `buildApp` mide hoy 61 líneas (57-117) y esta tarea lo modifica,
   así que se extrae `composeServices(db, now, ports)` (≤ 50 líneas), que crea, **en este orden**: repositorios de
   `jobs` y `applications`, servicio de `candidates`, servicio de `applications` y servicio de `jobs`, y devuelve los
   tres servicios. `buildApp` (≤ 50) solo crea Fastify, registra manejador de errores, guarda entre sitios, `onClose`,
   salud y las tres rutas. El puerto se conecta con un objeto de dos lambdas **tipado** (la asignación comprueba la
   forma, DEC-06):
   ```ts
   const jobApplicationsPort: JobApplicationsPort = jobApplications ?? {
     countActiveApplications: (jobId) => applications.countActiveApplications(jobId),
     rejectActiveApplications: (input) => applications.rejectActiveApplications(input),
   };
   ```
   - `buildApp` deja de importar y de usar `noJobApplications` (sin valor por defecto en la desestructuración);
     `jobApplications?` sigue en `AppOptions` para inyectar dobles en tests.
   - Comentario de `AppOptions.jobApplications` (`app.ts:28`): por defecto, la implementación real de `applications`
     (HU-06); solo se inyecta en tests.
   - Se mantienen los comentarios DD-01/DD-08/DD-09 existentes y el `CandidateLookupPort` en dos lambdas.
2. **Comentarios del puerto** (`apps/api/src/modules/jobs/applications-port.ts`, **solo comentarios**, DD-07):
   líneas 1-4, ya sin «HU-05»: lo implementa `applications` y se conecta en `buildApp`; línea 15: `noJobApplications`
   queda como **doble neutro para tests de `jobs`** (lo importa `apps/api/test/jobs/state-guards.test.ts`). Firma sin
   cambios.
3. **Helper de tests** (`apps/api/test/helpers/test-app.ts`, **solo el comentario** de `createTestApp`, líneas 13-16):
   sin `jobApplications`, el puerto real de `applications` (ya no `noJobApplications`).
4. **Test de HU-02 que se sustituye** (`apps/api/test/jobs/close.test.ts`): **eliminar** el bloque
   `describe('POST /api/jobs/:id/close — puerto por defecto (INV-05)', …)` de las líneas 199-216 (con su comentario de
   la línea 200) y la línea en blanco anterior. Lo sustituyen CA-01, CA-04, CA-06 y CA-10. El resto del fichero no
   cambia (sigue con el espía).
5. **Tests nuevos por la API con el puerto real** (`createTestApp` sin `jobApplications`, reloj `createTestClock`):
   - `apps/api/test/applications/close-reject.test.ts`: CA-01..CA-05, CA-09, CA-10, EC-02, EC-04, EC-05.
   - `apps/api/test/applications/close-preview-count.test.ts`: CA-08, EC-09 (0/1/4), EC-12 (seed con `seed(db, NOW)`).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/api/src/app.ts` | modificar | `composeServices` (≤ 50), `buildApp` (≤ 50), puerto real por defecto, comentario de `jobApplications?` |
| `apps/api/src/modules/jobs/applications-port.ts` | modificar | Solo comentarios (líneas 1-4 y 15) |
| `apps/api/test/helpers/test-app.ts` | modificar | Solo el comentario de `createTestApp` (líneas 13-16) |
| `apps/api/test/jobs/close.test.ts` | modificar | Eliminar el `describe` de EC-14 de HU-02 (líneas 199-216) |
| `apps/api/test/applications/close-reject.test.ts` | crear | Cierre real por la API: CA-01..CA-05, CA-09, CA-10, EC-02, EC-04, EC-05 |
| `apps/api/test/applications/close-preview-count.test.ts` | crear | Previa real: CA-08, EC-09, EC-12 |

## Implementa
- RF: RF-01, RF-02, RF-03 · RF-06 (umbrales de `app.ts`) · Edge cases: EC-02, EC-04, EC-05, EC-07 (por la API),
  EC-09 (0/1/4), EC-11, EC-12, EC-15, EC-20 · CA-01 a CA-05, CA-08, CA-09, CA-10 · DD-06, DD-07
- Diseño: `plans/TECHNICAL_DOC-backend.md` § Enfoque técnico (3), § Módulos y ficheros afectados, DD-06, DD-07,
  § Estrategia de tests (`close-reject.test.ts`, `close-preview-count.test.ts`, *Criterio → test*), § Checklist 2

## Dependencias
- **Depende de:** TASK-01
- **Bloquea:** TASK-03, TASK-04, TASK-05, TASK-06, TASK-07

## Criterios de done
- [ ] `npm test -w apps/api -- applications/close-reject applications/close-preview-count` en verde con **2**
      ficheros y estos tests (nombres del TD):
  - `CA-01 previa 2; cierre rechaza received y offer con job_closed en closedAt; hired intacta` (reloj en
    `2026-10-06T22:30:00.000Z`; `StageChange` de cada una: origen su etapa, `rejected`, `changed_at = closedAt`,
    `job_closed`, nota `null`; la `hired` sin `StageChange` nuevo).
  - `CA-02 los rechazados sin otras abiertas quedan con retención 2027-04-07; la del contratado no cambia`.
  - `CA-03/EC-04 inscrita tras la previa también se rechaza; inscribir tras el cierre → 409` (previa 1 → inscribir
    otra → cerrar → las dos `rejected` con `job_closed`; inscribir después → 409 `INVALID_TRANSITION`).
  - `CA-04 sin activas o todas finales: closed, 0 StageChange y retenciones iguales`.
  - `CA-05 con otra abierta en B: A rechazada, B intacta, retención null`.
  - `CA-09 buildApp sin jobApplications rechaza con el puerto real`.
  - `CA-10/EC-20 segundo cierre 1 h después: closedAt original, 0 StageChange, retenciones iguales`.
  - `EC-02 6 etapas: 4 rechazadas; hired y rechazo manual (motivo y nota) intactos; retención 2027-04-07`.
  - `EC-05 inscrita con la retención vencida → cierre + 6 meses (RGPD §7, cuestión 4)`.
  - `CA-08 previa: 6 etapas → 4, draft → 0, closed del seed → 0, solo activeApplications` (incluye EC-09 con 0, 1 y 4
    y EC-12 con un `draft` y una `closed` de `seed(db, NOW)`).
- [ ] **Mutaciones de la review** (cada una la detecta al menos un test de esta tarea):
  - **M1** (quitar la llamada a `rejectActiveApplications` del cierre, en `jobs/service.ts` o en la lambda de
    `app.ts`): falla `close-reject.test.ts › CA-01 …` (las dos siguen en su etapa) y `› CA-09 …`.
  - **M2** (`countActiveApplications` cuenta también las finales): falla `close-preview-count.test.ts › CA-08 …` (6 en
    vez de 4; la `closed` del seed > 0) y `close-reject.test.ts › CA-01 …` (previa 3 en vez de 2).
  - Comprobación manual del builder, sin commitear: aplicar M1 y M2 una a una, ver el test en rojo y deshacerlas. El
    diff final no toca `apps/api/src/modules/jobs/service.ts`.
- [ ] `npm test -w apps/api` **completo** en verde (la composición afecta a los tres módulos; incluye
      `module-boundaries.test.ts` y `jobs/close.test.ts` sin el bloque de EC-14).
- [ ] `composeServices` ≤ 50 y `buildApp` ≤ 50 líneas; `app.ts` ~130. Ningún fichero tocado pasa de 300 líneas ni
      ninguna función nueva o modificada de 50 (`wc -l` tras Prettier); si `close-reject.test.ts` se acerca a 300, para
      y avisa antes de crear otro fichero.
- [ ] `grep -n 'noJobApplications' apps/api/src/app.ts` sin resultados; `grep -n 'HU-05' apps/api/src/modules/jobs/applications-port.ts`
      sin resultados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/api/src/app.ts apps/api/src/modules/jobs/applications-port.ts apps/api/test/helpers/test-app.ts apps/api/test/jobs/close.test.ts apps/api/test/applications/close-reject.test.ts apps/api/test/applications/close-preview-count.test.ts`
      sin errores.
- [ ] Commit único `feat(api): wire the real JobApplicationsPort into buildApp [HU-06 TASK-02]` con los 6 ficheros.

## Notas de implementación
- `createTestApp` sin `jobApplications` ya usa el puerto real en cuanto `buildApp` lo conecta: no hace falta tocar su
  código, solo el comentario.
- Retención (DEC-09): cierre a `2026-10-06T22:30:00.000Z` = 07/10/2026 en Europe/Madrid → `2027-04-07` para un
  candidato sin consentimiento ni otras abiertas. Con otra inscripción abierta, `null` (CA-05).
- EC-05: la inscripción con retención vencida se escribe sobre un candidato cuya `retention_ends_at` ya pasó (SQL
  directo del test sobre `candidates`, o el helper que ya use HU-04 para DT-06); se fija el comportamiento actual, no se
  corrige.
- El reloj de cierre tiene que ser **posterior** al `created_at` de todas las inscripciones (`CHECK last_change_at >=
  created_at`).
- Datos inventados: `@example.com`, teléfonos `+34 600 000 0xx` (RGPD §6.3).
- Riesgo de regresión de cableado (DD-06): no cambies qué servicio recibe qué; solo el orden de creación.
