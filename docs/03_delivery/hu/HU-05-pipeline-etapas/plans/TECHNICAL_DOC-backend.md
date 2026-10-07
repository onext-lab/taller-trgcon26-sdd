# HU-05 — Pipeline con cambio de etapa e historial — Diseño técnico (backend)

- **Origen:** `specs/PRD.md` (estado Ready, v1.1, 2026-10-07; mandan DT-01 a DT-11)
- **Generado por:** backend-architect
- **Scope cubierto:** RF-01, RF-02, RF-03 y la parte API de RF-09. RF-05 a RF-08 son del TD-frontend, que consume el
  contrato de este documento. RF-04 y UC-19 / UC-04 · A1: HU-06 (DT-01).

## Enfoque técnico

Todo vive en `apps/api/src/modules/applications/` con las capas de siempre. **Sin migración** (el esquema de
`003-create-applications.sql` ya defiende INV-03, INV-04, INV-07 e INV-10) y **sin cambios en `apps/api/src/app.ts`**.

1. **RF-09 primero:** `createApplicationsService` (54 líneas según la review de HU-04; `service.ts:52-112`) pasa a ser una factoría de ~10
   líneas que solo compone; cada caso de uso es una función de módulo que recibe `deps` (DD-06). Sin cambio de
   comportamiento: las suites de HU-04 siguen en verde antes de añadir nada.
2. **Reglas de transición puras** en `transitions.ts` (nuevo), como `apps/api/src/modules/jobs/rules.ts`: deciden
   `'apply'` o `'noop'` o lanzan el 409 que toca, en el orden de DT-02 (DD-01, DD-05).
3. **Avanzar y rechazar** (`POST /api/applications/:id/advance` · `/reject`): una sola `withTransaction`
   (`BEGIN IMMEDIATE`) con lectura → regla → `UPDATE … WHERE id = ? AND stage = ?` (guarda; 0 filas → 409) →
   `INSERT` del `StageChange` → `recalculateRetention` si el destino es final (DD-02, DD-07). **No leen el estado de la
   oferta** (DT-09, DD-03).
4. **Detalle** (`GET /api/applications/:id`): inscripción e historial por SQL propio; título y estado de la oferta por
   `getJobSummary`, que se añade al `JobStatusPort` existente y que implementa `apps/api/src/modules/jobs/job-status.ts`
   (DD-04); nombre por `findNames`. Sin transacción (DD-08).

**Alternativa principal descartada:** dejar que los `CHECK` de `stage_changes` decidan las transiciones y traducir el
error de SQLite. Se pierde la distinción `STAGE_MISMATCH` / `INVALID_TRANSITION` y el reintento idempotente (200), y el
error llegaría después de escribir el `UPDATE`. Los `CHECK` se quedan como segunda línea de defensa.

## Módulos y ficheros afectados

| Módulo | Fichero | Cambio |
|---|---|---|
| applications | `apps/api/src/modules/applications/transitions.ts` | **nuevo**: `NEXT_STAGE`, `isFinal`, `decideAdvance`, `decideReject` |
| applications | `apps/api/src/modules/applications/service.ts` | modificar: RF-09 (funciones de módulo) y `advance`, `reject`, `getDetail` |
| applications | `apps/api/src/modules/applications/repository.ts` | modificar: `findById`, `updateStage`, `listHistory` (columnas explícitas) |
| applications | `apps/api/src/modules/applications/schemas.ts` | modificar: `MANUAL_REJECTION_REASONS`, `advanceBodySchema`, `rejectBodySchema`, `applicationDetailSchema` y tipos |
| applications | `apps/api/src/modules/applications/routes.ts` | modificar: 3 rutas y el hook `trimNote` |
| applications | `apps/api/src/modules/applications/ports.ts` | modificar: `JobSummary` y `getJobSummary` en `JobStatusPort` |
| jobs | `apps/api/src/modules/jobs/job-status.ts` | modificar: `getJobSummary` |
| jobs | `apps/api/src/modules/jobs/repository.ts` | modificar: `findSummaryById` (`SELECT status, title`) |
| transversal | `apps/api/src/errors.ts` | modificar: `stageMismatch(message)` → `AppError('STAGE_MISMATCH', 409, …)` |
| tests | `apps/api/test/helpers/applications.ts` | modificar: stub con `title` y `failSummary`, espía que delega `getJobSummary`, `advance`, `reject`, `getApplication`, `insertApplicationAt` |
| tests | `apps/api/test/applications/privacy-logs.test.ts:43` | modificar: el literal `statusPort` implementa también `getJobSummary` (si no, no compila) |
| tests | `apps/api/test/applications/{ports,performance}.test.ts` | modificar: lector `getJobSummary`; RNF-01 y RNF-02 |
| tests | `apps/api/test/applications/*.test.ts` (**nuevos**) | ver *Estrategia de tests* |

Sin cambios: `apps/api/src/app.ts` (el lector de `jobs` ya se conecta como `JobStatusPort`; la asignación tipada
comprueba la forma nueva), `apps/api/src/modules/candidates/` (solo se invoca `recalculateRetention`),
`apps/api/src/modules/jobs/applications-port.ts` (HU-06), la migración y el seed. Tamaños previstos tras la HU:
`service.ts` ~210, `schemas.ts` ~235, `repository.ts` ~190, `routes.ts` ~90 líneas (≤ 300).

## Contrato de API

Errores en el envelope `{ error: { code, message, details? } }` del manejador único
(`apps/api/src/http/error-handler.ts`). Ajv estricto (DEC-11.1). La guarda `CROSS_SITE_REQUEST` (DEC-12) es global:
la heredan los dos `POST`.

### Tipos

```ts
type Stage = 'received' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
type ManualRejectionReason = 'not_a_fit' | 'candidate_withdrew' | 'other';         // S-15: nunca job_closed
type RejectionReason = ManualRejectionReason | 'job_closed';

interface Application {            // 200 de advance y reject (también en el reintento): exactamente 6 campos
  id: number; jobId: number; candidateId: number; stage: Stage; createdAt: string; lastChangeAt: string;
}
interface StageChangeEntry {       // orden por stage_changes.id (del más antiguo al más reciente)
  fromStage: Stage | null;         // null solo en el inicial
  toStage: Stage; changedAt: string;
  reason: RejectionReason | null;  // no nulo si y solo si toStage === 'rejected' (INV-07)
  note: string | null;             // solo en el de rechazo; único sitio donde sale la nota (RNF-05)
}
interface ApplicationDetail {      // 200 de GET /api/applications/:id (DT-07)
  id: number; stage: Stage; createdAt: string; lastChangeAt: string;
  candidate: { id: number; fullName: string };                         // nunca email ni teléfono
  job: { id: number; title: string; status: 'draft' | 'published' | 'closed' };
  history: StageChangeEntry[];                                          // 1 a 5 elementos; sin paginar (DEC-10 N/A)
}
```

### Endpoints

| Método y ruta | Entrada (JSON Schema) | Éxito | Errores |
|---|---|---|---|
| `POST /api/applications/:id/advance` | `params`: `idParamsSchema` (`^[1-9][0-9]{0,14}$`, `apps/api/src/http/validation.ts`). `body`: `advanceBodySchema` | **200** `Application` | 400 · 403 · 404 · 409 `STAGE_MISMATCH` · 409 `INVALID_TRANSITION` · 413 · 415 · 500 |
| `POST /api/applications/:id/reject` | `params`: ídem. Hook `preValidation` `trimNote`. `body`: `rejectBodySchema` | **200** `Application` | Los mismos |
| `GET /api/applications/:id` | `params`: ídem. `querystring`: `pipelineQuerySchema` (objeto vacío, `additionalProperties: false`) | **200** `ApplicationDetail` | 400 · 404 · 500 |

```ts
const STAGE = { type: 'string', enum: STAGES } as const;
export const MANUAL_REJECTION_REASONS = ['not_a_fit', 'candidate_withdrew', 'other'] as const;

export const advanceBodySchema = {
  type: 'object', additionalProperties: false, required: ['expectedStage', 'toStage'],
  properties: { expectedStage: STAGE, toStage: STAGE },
} as const;

export const rejectBodySchema = {
  type: 'object', additionalProperties: false, required: ['expectedStage', 'reason'],
  properties: {
    expectedStage: STAGE,
    reason: { type: 'string', enum: MANUAL_REJECTION_REASONS },
    // Tras trimNote: recortada y "" → null (DEC-11.3). Ajv cuenta puntos de código, como length() de SQLite.
    note: { type: ['string', 'null'], maxLength: 500, pattern: NO_CONTROL_CHARS_EXCEPT_WHITESPACE }, // DEC-11.8
  },
} as const;

// routes.ts
const trimNote: preValidationHookHandler = (request, _reply, done) => {
  trimTextFields(request.body, { trim: ['note'], emptyToNull: ['note'] });
  done();
};
```

`response` por código: `200: applicationSchema` (el de HU-04) en los dos `POST` y `200: applicationDetailSchema` en el
`GET`, con `additionalProperties: false` y `required` completos en el objeto, en `candidate`, en `job` y en cada
elemento de `history`. `note` ausente en el cuerpo del rechazo equivale a `null`.

### Orden de comprobación (DT-02, DD-05)

`CROSS_SITE_REQUEST` (403, `onRequest`) → parser (415, 413, JSON roto o vacío → 400) → `trimNote` (solo rechazo) →
JSON Schema: `params` y luego `body` (400; Fastify valida `params` antes que `body`, así que con los dos mal solo sale
`{ field: 'id' }`) → **dentro de `withTransaction`**: `findById` (404) → regla de `transitions.ts` → escrituras.

| Avanzar `{ expectedStage, toStage }` sobre etapa actual `cur` | Resultado |
|---|---|
| 1. `toStage === cur` y `toStage` ∈ {`screening`, `interview`, `offer`, `hired`} | **200** sin escrituras ni `now()` (RV-23 prevalece, UC-15 · A1) |
| 2. `expectedStage !== cur` | **409 `STAGE_MISMATCH`** (UC-15 · E1) |
| 3. `cur` ∈ {`hired`, `rejected`} | **409 `INVALID_TRANSITION`** «La inscripción está en una etapa final: no admite cambios.» (E3) |
| 4. `toStage !== NEXT_STAGE[cur]` (salto, retroceso, `received`, `rejected`) | **409 `INVALID_TRANSITION`** «Solo se puede avanzar a la etapa siguiente.» (E2, DT-03) |
| 5. Si no | `apply` |

| Rechazar `{ expectedStage, reason, note? }` sobre `cur` | Resultado |
|---|---|
| 1. `cur === 'rejected'` | **200** sin escrituras, con cualquier `expectedStage`; motivo y nota originales intactos (UC-16 · A1) |
| 2. `expectedStage !== cur` | **409 `STAGE_MISMATCH`** (E3) |
| 3. `cur === 'hired'` | **409 `INVALID_TRANSITION`** «Una inscripción contratada no se puede rechazar.» (E4) |
| 4. Si no | `apply` (`rejected`, con `reason` y `note`) |

### Errores específicos

| `code` | HTTP | `message` | `details` |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | «Hay campos con errores.» (JSON roto: «El cuerpo de la petición no es JSON válido.») | Uno por campo declarado (`id`; `expectedStage`, `toStage`; `reason`, `note`) + `{ field: 'body', message: 'Hay campos no permitidos.' }` para todas las claves no declaradas (`note` o `reason` en el avance, `toStage` o `stage` en el rechazo), sin nombrarlas (DEC-11.4). En el `GET`, `{ field: 'querystring' }`. Nunca el valor recibido (la nota tampoco) |
| `NOT_FOUND` | 404 | «La inscripción no existe.» | — |
| `STAGE_MISMATCH` | 409 | «La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.» (DT-02); el mismo con 0 filas en el `UPDATE` (DD-02) | — |
| `INVALID_TRANSITION` | 409 | Los tres de las tablas de arriba | — |
| `CROSS_SITE_REQUEST` · `PAYLOAD_TOO_LARGE` · `UNSUPPORTED_MEDIA_TYPE` · `INTERNAL_ERROR` | 403 · 413 · 415 · 500 | Los de siempre | — |

Ningún `message` ni `details` lleva nombre, email, teléfono, nota ni etapa recibida. La web pinta sus propios textos
por `code` (DT-06).

### Firmas internas

```ts
// ports.ts — lo define applications (DEC-06)
export interface JobSummary { status: JobStatus; title: string }
export interface JobStatusPort {
  getJobStatus(jobId: number): JobStatus | null;
  getJobSummary(jobId: number): JobSummary | null;          // nuevo (DT-07); null = la oferta no existe
}

// transitions.ts — sin HTTP ni SQL
export const NEXT_STAGE: Readonly<Partial<Record<Stage, Stage>>>;   // received→screening→interview→offer→hired
export function isFinal(stage: Stage): boolean;                       // hired | rejected
export function decideAdvance(current: Stage, input: AdvanceInput): 'apply' | 'noop';        // o lanza 409
export function decideReject(current: Stage, expectedStage: Stage): 'apply' | 'noop';         // o lanza 409

// service.ts — ApplicationsServiceDeps no cambia
export interface ApplicationsService {
  enroll(input: EnrollInput): Application;
  getPipeline(jobId: number): Pipeline;
  advance(id: number, input: AdvanceInput): Application;     // en withTransaction
  reject(id: number, input: RejectInput): Application;       // en withTransaction
  getDetail(id: number): ApplicationDetail;                  // sin transacción (DD-08)
}
// Interno: applyStageChange(deps, application, { toStage, reason, note }): Application
//   changedAt = now() (una vez) → repository.updateStage(...) ?? throw stageMismatch → insertStageChange(...)
//   → if (isFinal(toStage)) recalculateRetention(application.candidateId)

// repository.ts — createApplicationsRepository(db), sentencias preparadas
findById(id: number): Application | undefined
//   SELECT id, job_id, candidate_id, stage, created_at, last_change_at FROM applications WHERE id = ?
updateStage(c: { id: number; fromStage: Stage; toStage: Stage; changedAt: string }): Application | undefined
//   UPDATE applications SET stage = ?, last_change_at = ? WHERE id = ? AND stage = ?
//   RETURNING id, job_id, candidate_id, stage, created_at, last_change_at          (undefined = 0 filas)
listHistory(applicationId: number): StageChangeEntry[]
//   SELECT from_stage, to_stage, changed_at, reason, note FROM stage_changes
//   WHERE application_id = ? ORDER BY id                 (índice stage_changes_application_idx)

// jobs/repository.ts y jobs/job-status.ts — implementa el puerto sin importarlo
findSummaryById(id: number): { status: JobStatus; title: string } | undefined
//   SELECT status, title FROM job_openings WHERE id = ?
createJobStatusReader(repo: Pick<JobsRepository, 'findStatusById' | 'findSummaryById'>)
  → { getJobStatus(id), getJobSummary(id) { return repo.findSummaryById(id) ?? null } }
```

## Migración de datos

N/A — sin cambios de esquema. `003-create-applications.sql` ya admite todo lo que se escribe: el `CHECK` de transiciones
(INV-04), el de motivo y nota (INV-07, INV-10: nota 1-500 y solo en `rejected`), el único parcial
`stage_changes_one_final_uq` (como mucho un cambio final por inscripción) y los *triggers* de inmutabilidad (INV-03; la
HU no hace ningún `UPDATE` ni `DELETE` de `stage_changes`). El `UPDATE` de `applications` está libre desde HU-04. El seed
no cambia y no hace falta `npm run db:reset` tras el merge (sí tras el de HU-06).

## Diagrama de secuencia

```mermaid
sequenceDiagram
  participant W as Web
  participant R as applications/routes
  participant S as applications/service
  participant T as transitions.ts
  participant C as candidates (recalculateRetention)
  participant D as SQLite
  W->>R: POST /api/applications/:id/reject { expectedStage, reason, note }
  R->>R: 403 cross-site · trimNote · 400 params/body
  R->>S: reject(id, input)
  S->>D: BEGIN IMMEDIATE (withTransaction)
  S->>D: SELECT … FROM applications WHERE id = ?
  alt no existe
    S-->>R: 404 NOT_FOUND (ROLLBACK)
  end
  S->>T: decideReject(stage, expectedStage)
  alt noop (ya rejected)
    S-->>R: 200 Application sin escrituras (COMMIT vacío)
  else 409
    T-->>R: STAGE_MISMATCH / INVALID_TRANSITION (ROLLBACK)
  end
  S->>D: UPDATE applications SET stage, last_change_at WHERE id = ? AND stage = ? RETURNING …
  alt 0 filas
    S-->>R: 409 STAGE_MISMATCH (ROLLBACK)
  end
  S->>D: INSERT stage_changes (cur → rejected, now, reason, note)
  S->>C: recalculateRetention(candidateId) — en la misma transacción
  C->>D: getProcesses (lector de applications) · UPDATE candidates SET retention_ends_at
  S->>D: COMMIT
  R-->>W: 200 Application (6 campos, sin nota)
  Note over S,D: advance: igual con decideAdvance; recalculateRetention solo si toStage = hired.<br/>Ninguno llama a getJobStatus (DT-09).
  W->>R: GET /api/applications/:id
  R->>S: getDetail(id) — sin transacción
  S->>D: findById · listHistory
  S->>S: jobStatus.getJobSummary(jobId) · candidates.findNames([candidateId])
  R-->>W: 200 ApplicationDetail
```

## Error paths

| Edge case (PRD) | Dónde se detecta | Estrategia | Respuesta o efecto observable | Test |
|---|---|---|---|---|
| EC-01 | Parser · JSON Schema del `body` | rechazar | Sin `expectedStage`, `toStage: "foo"`, etapa numérica, cuerpo vacío o no JSON, `note`/`reason` de más → 400 (las de más, en `{ field: 'body' }`); nada cambia | `stage-change-adversarial.test.ts` |
| EC-02 | `params` (`pattern`) | rechazar | `abc`, `0`, `01`, 16 dígitos → 400 `{ field: 'id' }` | `stage-change-adversarial.test.ts` |
| EC-03 | Servicio · `pattern` | recorrer / 404 | 4 avances con 4 `StageChange` y fechas crecientes; `999999999999999` (máximo del `pattern`) inexistente → 404 sin datos; `Number.MAX_SAFE_INTEGER` (16 dígitos) → 400 (DD-10) | `advance.test.ts` |
| EC-04 | `decideAdvance` paso 4 | rechazar | `received → received` y `rejected → rejected` (esperada = actual) → 409 `INVALID_TRANSITION` | `advance.test.ts` |
| EC-05 | SQLite (`failWrites` en `UPDATE applications`, `INSERT stage_changes`, `UPDATE OF retention_ends_at`) | `ROLLBACK` | 500 `INTERNAL_ERROR` sin *stack*; etapa, historial y retención como antes | `stage-change-failures-adversarial.test.ts` |
| EC-06 | `decideAdvance` paso 2 | rechazar | Segunda pestaña con esperada `screening` tras el avance → 409 `STAGE_MISMATCH` | `stage-change-adversarial.test.ts` |
| EC-08 | Ninguna guarda de oferta (DD-03) | permitir | Activa de una `closed` → 200 y `StageChange` | `advance.test.ts` (CA-39) |
| EC-09 | Mensajes fijos · manejador · DEC-12 | no exponer / rechazar | 404, 409 y 500 sin nombre, email ni teléfono en cuerpo ni log; `cross-site` → 403 y nada cambia | `stage-change-privacy.test.ts`, `stage-change-adversarial.test.ts` |
| EC-10 | `decideAdvance` paso 1 | no-op | Reintento (también a `hired`) → 200 sin `StageChange`, `lastChangeAt` y retención iguales | `advance.test.ts` |
| EC-11 | JSON Schema | rechazar | Sin motivo, `job_closed`, `foo`, número; nota no texto; `toStage` de más → 400; nada cambia | `stage-change-adversarial.test.ts` |
| EC-12 | `pattern` de `note` | rechazar / aceptar | NUL o U+0007 → 400; `\n`, `\r`, `\t` dentro → 200 y se guardan | `stage-change-adversarial.test.ts` |
| EC-13 | `trimNote` · `maxLength` | aceptar / rechazar | 500 → 200; 501 → 400; 500 emojis → 200; solo espacios → `note: null`; espacios alrededor → recortada | `reject.test.ts` |
| EC-14 | SQLite (`failWrites`) | `ROLLBACK` | Igual que EC-05 para el rechazo | `stage-change-failures-adversarial.test.ts` |
| EC-15 | `BEGIN IMMEDIATE` + `decide*` paso 2 | serializar | Rechazo y avance con la misma esperada en paralelo: un 200 y un 409 `STAGE_MISMATCH`, en cualquier orden; 1 `StageChange` nuevo | `stage-change-adversarial.test.ts` |
| EC-16 | `decideReject` paso 1 | no-op | `rejected` con `job_closed` → 200; conserva `job_closed` y `note: null` | `reject.test.ts` |
| EC-17 | Sentencias preparadas | guardar literal | `<script>`, comillas, `'; DROP TABLE` → se guardan tal cual, salen solo en el detalle; las tablas siguen | `stage-change-adversarial.test.ts` |
| EC-18 | `decideReject` paso 1 | no-op | Segundo rechazo con otro motivo y nota → 200; motivo y nota del primero | `reject.test.ts` |
| EC-19 | `params` · `querystring` | rechazar | `abc`, `0`, `?x=1` → 400 | `detail-adversarial.test.ts` |
| EC-20 | `listHistory` (`ORDER BY id`) | ordenar | 1 cambio sin origen; 5 en orden (contratada); inexistente → 404 | `detail.test.ts` |
| EC-21 | Puerto · SQLite | 500 | `createJobStatusStub({ failSummary: true })` y `candidates` renombrada → 500 sin datos | `detail-adversarial.test.ts` |
| EC-22 | `getDetail` | 500 sin inventar | `job_closed` → motivo y `note: null`; sin nombre (FK desactivada en el test y candidato borrado) → 500, nunca un nombre inventado (DD-08) | `detail.test.ts`, `detail-adversarial.test.ts` |
| EC-23 | `applicationDetailSchema` · `findNames` | minimizar | Con email, teléfono y nota: sale la nota y el nombre; 0 claves `email`/`phone` | `detail-adversarial.test.ts` |
| EC-07, EC-24 a EC-30 | — | — | Movidos a HU-06 (DT-01) | — |
| EC-31 a EC-50 | Web | — | TD-frontend. La API ya cubre su parte: los 409 (EC-33, EC-39: CA-06, CA-17), el reintento 200 (EC-35: EC-10), la acción aplicada en una `closed` (EC-48: CA-39) y una respuesta con dominios cerrados por el `response` schema (EC-45) | TD-frontend |

## Threat modeling

DEC-04: sin login, un único rol; API solo en `127.0.0.1`.

| STRIDE | Amenaza concreta | Mitigación |
|---|---|---|
| Suplantación | Otra web lanza `advance`/`reject` (CSRF) | DEC-12: 403 `CROSS_SITE_REQUEST`; el `POST` con JSON exige además *preflight* |
| Manipulación | *Mass assignment*: `stage`, `candidateId`, `changedAt` o `reason: 'job_closed'` en el cuerpo | `additionalProperties: false` y `enum` sin `job_closed` → 400; etapa, fechas y origen los fija el servicio |
| Manipulación | Inyección SQL por la nota o el ID | Sentencias preparadas; ID validado por `pattern` y `Number()`; nota como parámetro |
| Manipulación | Saltarse la máquina de estados o reescribir el historial | `decide*` + guarda en el `WHERE` + `CHECK` de transiciones + único parcial de cambio final + *triggers* de inmutabilidad; no hay ruta de edición |
| Repudio | Cambios sin rastro | Cada cambio aplicado deja un `StageChange` inmutable con el reloj inyectado, en la misma transacción |
| Exposición | Nota o datos del candidato en respuestas, errores o logs | Respuestas de `advance`/`reject` con 6 campos; la nota solo en el detalle; mensajes fijos; el manejador solo registra el objeto de error de los 500 (los de SQLite nombran columnas, no valores); sin logs nuevos; sin `SELECT *` sobre `candidates` |
| Exposición | Enumeración de IDs del detalle (nombre y nota) | Aceptada con DEC-04; 404 sin datos. Con login, el detalle y las acciones exigirían el rol «reclutador» |
| Denegación | Notas enormes | `maxLength` 500 y límite de cuerpo de Fastify (413) |
| Elevación | — | N/A — sin roles (DEC-04) |

## Datos personales

- **Entran:** IDs, etapas, motivo y la **nota de rechazo** (texto libre que puede identificar, RV-20), recortada,
  ≤ 500 puntos de código y sin controles salvo `\n`, `\r`, `\t`.
- **Se guardan:** el historial (`stage_changes`) y, a través de `recalculateRetention`, `candidates.retention_ends_at`
  (único escritor: `candidatos`; la fórmula no se duplica).
- **Se devuelven:** `advance`/`reject`, la `Application` sin nota ni datos del candidato; el detalle, `fullName` (por
  `findNames`: `id`, `full_name`) y la nota en su `StageChange`. Nunca email ni teléfono (RGPD §6.2). El pipeline no
  cambia (5 campos, sin nota).
- **Retención (RGPD §3):** pasar a `hired` o `rejected` recalcula en la misma transacción; con otra inscripción abierta
  sigue `null`; si era la última, cierre + 6 meses o consentimiento + 24 meses, la más tardía.
- **Nunca en logs ni errores (DP-01):** ni nombre, ni email, ni teléfono, ni nota. El 400 de la nota no la repite
  (DEC-11.4). Los errores internos de `getDetail` (DD-08) llevan textos fijos sin datos.
- **DP-02:** ninguna lectura nueva sobre `candidates`; `recalculateRetention` sigue con su `SELECT *` (deuda de la
  feature A, sin fuga: el retorno se descarta).
- **Supresión:** el *trigger* ya permite `SET note = NULL` para la anonimización; vaciar la nota es una cuestión abierta
  de la feature A (RGPD §7.3). Esta HU no lo hace.

## Decisiones de diseño

### DD-01: Reglas de transición puras en `transitions.ts`
- **Contexto:** RV-19, RV-22 y RV-23 con dos 409 distintos (DT-02) y un 200 idempotente.
- **Opciones consideradas:** A) Condicionales dentro del servicio. B) Delegar en los `CHECK` y traducir el error de
  SQLite. C) Funciones puras `decideAdvance`/`decideReject` con `NEXT_STAGE`, como `jobs/rules.ts`.
- **Elegida:** C.
- **Razón:** se prueban en unitario con la tabla completa (6 × 6 × 6 en el avance) sin base; B no distingue los 409 ni
  da el 200; A engorda el servicio que RF-09 pide adelgazar.
- **Tradeoff:** la máquina de estados queda en dos sitios (`transitions.ts` y el `CHECK` de la migración `003`); un
  cambio de etapas exige tocar los dos (y una migración).

### DD-02: Guarda de etapa en el `WHERE` del `UPDATE`; 0 filas → 409 `STAGE_MISMATCH`
- **Contexto:** convención SEC-02 de HU-04 (DD-09): la guarda de estado va también en la escritura.
- **Opciones consideradas:** A) `UPDATE … WHERE id = ?` confiando en la lectura previa. B) `WHERE id = ? AND stage = ?`
  con `RETURNING`; 0 filas → `INVALID_TRANSITION`, como HU-04. C) Lo mismo, 0 filas → `STAGE_MISMATCH`.
- **Elegida:** C.
- **Razón:** 0 filas significa que la etapa cambió entre la lectura y la escritura, que es justo «la etapa esperada ya
  no es la actual». Con `BEGIN IMMEDIATE` y una conexión síncrona es inalcanzable por la API; se prueba con un
  repositorio real envuelto cuyo `findById` devuelve la etapa anterior.
- **Tradeoff:** un camino defensivo más con su test; difiere del código que usa HU-04 para su caso análogo.

### DD-03: Avanzar y rechazar no comprueban el estado de la oferta (DT-09)
- **Contexto:** DT-09 (OQ-08 del PRD) lo decide así mientras la ventana de INV-05 siga abierta (DT-10 de HU-04, hasta
  HU-06): una inscripción activa de una oferta `closed` se puede mover por la API; la web no ofrece la acción (RF-08).
- **Opciones consideradas:** A) Leer `getJobStatus` en la transacción y dar 409 si no es `published`. B) No leerlo.
- **Elegida:** B, por DT-09.
- **Razón:** los UC no lo piden y, con HU-06, una `closed` no tendrá inscripciones no finales; A añadiría un 409 que la
  web no maneja y bloquearía la única salida de los datos de la ventana.
- **Tradeoff:** la API permite cambios en ofertas cerradas. Lo fijan dos tests con nombre explícito («CA-39 … DT-09,
  HU-06 lo revisa»): avanzar y rechazar una activa de una `closed` → 200, y un `createJobStatusSpy` sin llamadas durante
  ambos. **HU-06 debe revisar esta decisión a propósito** y cambiar esos tests si la cambia.

### DD-04: `getJobSummary` en el `JobStatusPort` existente
- **Contexto:** DT-07 pide el título por `getJobSummary`, definida en `applications` e implementada en `job-status.ts`.
- **Opciones consideradas:** A) Puerto nuevo `JobSummaryPort` con su opción en `buildApp`. B) Un segundo método en
  `JobStatusPort`, servido por el mismo lector y la misma opción `jobStatus?`.
- **Elegida:** B.
- **Razón:** `app.ts` no cambia y los tests inyectan fallos por la opción que ya existe (EC-21).
- **Tradeoff:** todo doble del puerto implementa los dos métodos: cambian `createJobStatusStub`, `createJobStatusSpy` y
  el literal de `privacy-logs.test.ts:43`; el nombre del puerto se queda corto («estado» y resumen).

### DD-05: Orden de las reglas: el de DT-02 y RF-01
- **Contexto:** DT-03 dice que un destino `received` o `rejected` da «siempre» `INVALID_TRANSITION` «aunque sea la etapa
  actual»; RF-01 y DT-02 fijan el orden reintento → esperada → transición.
- **Opciones consideradas:** A) Mirar `received`/`rejected` antes que la etapa esperada. B) El orden de RF-01: con la
  esperada desactualizada, `STAGE_MISMATCH`; con la esperada al día, `INVALID_TRANSITION`.
- **Elegida:** B. Confirmada por el aprobador (2026-10-07); el PRD v1.2 aclara DT-03 a «siempre que la esperada
  coincida».
- **Razón:** RF-01 lo lista literalmente («`rejected` aunque sea la actual» va en el paso de `INVALID_TRANSITION`, tras
  `STAGE_MISMATCH`); DT-03 descarta el reintento, no la comprobación de la esperada. CA-07, CA-08 y EC-04 usan la
  esperada al día y dan `INVALID_TRANSITION`. Como el reintento va **antes** que la esperada, una petición con la
  esperada desactualizada cuyo destino ya es la etapa actual (en el avance, solo `screening` a `hired`) da 200 sin
  escrituras (RV-23); en el rechazo, también con un motivo o una nota distintos de los guardados. Lo fijan dos tests
  explícitos (*Estrategia de tests*, B-03 y B-04).
- **Tradeoff:** con esperada desactualizada y destino `rejected` el código es `STAGE_MISMATCH`; los dos son 409, nada
  cambia y la web recarga en ambos.

### DD-06: RF-09 — casos de uso como funciones de módulo; la factoría solo compone
- **Contexto:** `createApplicationsService` mide 54 líneas (> 50, review de HU-04) y crecería con tres operaciones.
- **Opciones consideradas:** A) Helpers internos dentro de la factoría. B) Funciones de módulo `enroll(deps, input)`,
  `advance(deps, id, input)`, … y una factoría de ~10 líneas que las envuelve en `deps.transaction`. C) Un fichero por
  caso de uso.
- **Elegida:** B, más `transitions.ts` (DD-01).
- **Razón:** ninguna función pasa de 50 líneas, la factoría deja de crecer y `service.ts` queda en ~210 (≤ 300).
- **Tradeoff:** las funciones reciben `deps` explícito. Si `service.ts` pasara de 300, `advance`/`reject` irían a
  `stage-change.ts`.

### DD-07: Recálculo de la retención solo al pasar a una etapa final
- **Contexto:** RN-10 y RF-01 («si el destino es `hired`»).
- **Opciones consideradas:** A) Recalcular en todo avance. B) Solo si `isFinal(toStage)`.
- **Elegida:** B.
- **Razón:** un avance intermedio deja la inscripción abierta y la retención ya es `null` (INV-09); A añade una escritura
  en `candidates` y un punto de fallo sin efecto.
- **Tradeoff:** un dato incoherente previo (retención no nula con inscripción abierta) no lo corrige un avance intermedio.

### DD-08: Detalle sin transacción; ausencia de oferta o nombre → 500
- **Contexto:** EC-22: el nombre no puede faltar (FK), pero no se inventa.
- **Opciones consideradas:** A) Omitir el campo o rotular «Candidato desconocido». B) Error interno con texto fijo
  (`'Inscripción sin candidato'`, `'Inscripción sin oferta'`) → 500 `INTERNAL_ERROR`.
- **Elegida:** B, con las lecturas sin transacción como el pipeline (DD-07 de HU-04).
- **Razón:** el contrato exige `fullName` y `title`; un 500 señala el dato corrupto sin inventarlo ni filtrar datos.
- **Tradeoff:** un detalle corrupto no se puede ver; si la conexión dejara de ser única, habría que envolver la lectura
  en una transacción.

### DD-09: CA-39 sin cerrar ofertas con inscripciones activas
- **Contexto:** CA-39 pide una activa en una `closed`; la HU prohíbe que sus tests cierren ofertas con inscripciones
  activas (hu.md, DT-10 de HU-04).
- **Opciones consideradas:** A) Cerrar por la API con el stub. B) Cerrar la oferta vacía y escribir después la
  inscripción con `insertApplicationWithHistory` (`apps/api/src/db/seed-applications.ts`).
- **Elegida:** B.
- **Razón:** reproduce el estado de la ventana sin depender del comportamiento del cierre, que cambia en HU-06.
- **Tradeoff:** el estado se fabrica con SQL de fixture, no con el flujo real.

### DD-10: El ID de ruta mantiene el `pattern` de DEC-11.2 (era OD-01)
- **Contexto:** EC-03 pedía 404 con `:id` = `Number.MAX_SAFE_INTEGER` (16 dígitos), y EC-02, 400 con 16 dígitos.
  `idParamsSchema` (`^[1-9][0-9]{0,14}$`, `apps/api/src/http/validation.ts`) admite como mucho 15.
- **Opciones consideradas:** A) Ampliar el `pattern` a 16 dígitos con tope en `MAX_SAFE_INTEGER`. B) Mantenerlo.
- **Elegida:** B. Decisión del responsable técnico (2026-10-07); el PRD v1.2 corrige EC-03.
- **Razón:** el `pattern` es común a todas las rutas con ID (DEC-11.2); cambiarlo afectaría a ofertas y candidatos.
- **Tradeoff:** los IDs de 16 dígitos (≤ `MAX_SAFE_INTEGER`) no son direccionables por ruta; inalcanzables con el
  volumen del ATS. EC-03 se prueba con `999999999999999` → 404 y `Number.MAX_SAFE_INTEGER` → 400.

## Impacto en decisiones

- **Se aplican:** DEC-01 (envelope), DEC-04, DEC-06 (puerto `getJobSummary`, `recalculateRetention` dentro de la
  transacción, test de fallo inyectado por efecto cruzado y `module-boundaries`), DEC-07 (200 en el reintento, 404, 409
  `STAGE_MISMATCH` e `INVALID_TRANSITION`), DEC-08 (etapa esperada, estado en la transacción, guarda en el `WHERE`,
  RV-23 sobre RV-22), DEC-09 (reloj inyectado, UTC), DEC-11 (1, 2, 3, 4, 7 y 8) y DEC-12 (heredada).
- **DEC-10:** N/A — el historial tiene como mucho 5 cambios y no se pagina (lo declara el PRD).
- **Reutiliza:** `withTransaction`, `idParamsSchema`, `trimTextFields`, `NO_CONTROL_CHARS_EXCEPT_WHITESPACE`,
  `applicationSchema`, `pipelineQuerySchema`, `notFound`, `invalidTransition`, `insertStageChange`,
  `insertApplicationWithHistory`, `createTestApp`, `createTestClock`, `failWrites`, `createJobStatusStub`/`Spy`,
  `createCandidate`, `createPublishedJob`, `closeJob`.
- **No hace falta un `DEC-NN` nuevo** ni dependencias nuevas.

## Estrategia de tests

Vitest + `app.inject` sobre `:memory:` migrada (`createTestApp`), reloj `createTestClock`, fallos con `failWrites`
(creados **después** de preparar candidato, oferta e inscripción) y dobles reales sin mocks de módulo. Inscripciones en
cualquier etapa con `insertApplicationAt(db, { jobId, candidateId, path, startAt, reason?, note? })` (nuevo en
`apps/api/test/helpers/applications.ts`, sobre `insertApplicationWithHistory`) o con avances por la API. Datos
inventados (`@example.com`, `+34 600 000 0xx`, notas no sensibles). Ficheros en `apps/api/test/applications/`, todos
≤ 300 líneas.

| Criterio | Test previsto (fichero · nombre) |
|---|---|
| CA-01 | `advance.test.ts` · «CA-01 screening → interview: 200 Application, lastChangeAt = reloj, StageChange sin motivo ni nota» |
| CA-03 · EC-10 | `advance.test.ts` · «CA-03 reintento a interview con esperada screening → 200 sin StageChange, lastChangeAt y retención iguales; también a hired» |
| CA-04 | `advance.test.ts` · «CA-04 offer → hired: oferta sigue published, retentionEndsAt = día Madrid + 6 meses» |
| CA-05 | `advance.test.ts` · «CA-05 otra abierta en otra oferta no cambia y retención null; segundo hired en la misma oferta» |
| CA-06 | `advance.test.ts` · «CA-06 interview con esperada screening → 409 STAGE_MISMATCH, nada cambia» |
| CA-07 · EC-04 | `advance.test.ts` · «CA-07 screening → offer, received, rejected → 409 INVALID_TRANSITION»; «EC-04 received→received y rejected→rejected → INVALID_TRANSITION» |
| CA-08 | `advance.test.ts` · «CA-08 hired y rejected con su etapa como esperada → 409 INVALID_TRANSITION» |
| CA-09 · EC-01, EC-02 | `stage-change-adversarial.test.ts` · «CA-09 etapa desconocida, sin esperada, note de más, cuerpo vacío o no JSON, :id inválido → 400 y nada cambia» |
| CA-10 · EC-03 | `advance.test.ts` · «CA-10 inexistente → 404 sin datos»; «EC-03 recorrido completo con 4 StageChange crecientes», «EC-03 999999999999999 inexistente → 404 sin datos; MAX_SAFE_INTEGER → 400» (DD-10) |
| DD-05 · RV-23 (avance) | `advance.test.ts` · «RV-23 en interview, esperada screening (desactualizada) y destino interview → 200 sin escrituras: 0 StageChange nuevos, lastChangeAt y retención iguales, Application idéntica a la guardada» |
| DD-05 · RV-23 (rechazo) | `reject.test.ts` · «RV-23 ya rejected con not_a_fit y nota, esperada interview (desactualizada), motivo other y otra nota → 200 sin escrituras: motivo y nota guardados intactos, 0 StageChange nuevos, Application idéntica a la guardada» |
| CA-11 · EC-05 | `stage-change-failures-adversarial.test.ts` · «CA-11 fallo en UPDATE, en INSERT del StageChange y en retention al contratar → 500 y nada cambia» |
| CA-12 | `reject.test.ts` · «CA-12 interview rechazada con not_a_fit y nota de 500 → 200, StageChange con ambos, retención recalculada» |
| CA-14 · EC-16, EC-18 | `reject.test.ts` · «CA-14 reintento con otro motivo y nota → 200 sin StageChange, originales intactos»; «EC-16 job_closed se conserva» |
| CA-15 · EC-11 | `reject.test.ts` · «CA-15 sin motivo, foo, job_closed → 400 y nada cambia» (resto de EC-11 en `stage-change-adversarial.test.ts`) |
| CA-16 · EC-13 | `reject.test.ts` · «CA-16 nota de 501 → 400 sin la nota en el cuerpo; solo espacios → null»; «EC-13 500, 500 emojis, recorte» |
| CA-17, CA-18, CA-19 | `reject.test.ts` · «CA-17 esperada screening → 409 STAGE_MISMATCH», «CA-18 hired → 409 INVALID_TRANSITION», «CA-19 inexistente → 404» |
| CA-20 · EC-14 | `stage-change-failures-adversarial.test.ts` · «CA-20 fallo en UPDATE, INSERT y retención al rechazar → 500 y nada cambia» |
| CA-21 · RNF-04, RNF-05 · EC-09 | `stage-change-privacy.test.ts` · «CA-21 marcador de la nota ausente de logs, 400, 500, respuesta del rechazo y pipeline; presente solo en el detalle»; «RNF-04 nombre, email y teléfono ausentes de logs y cuerpos de 404, 409 y 500 de avance, rechazo y detalle» |
| CA-24, CA-25, CA-26 (API) · EC-20, EC-22 | `detail.test.ts` · «CA-24 3 cambios en orden con candidate, job.title y job.status», «CA-25 recién creada: 1 cambio sin origen», «CA-26 rechazo manual con motivo y nota; job_closed sin nota», «EC-20 contratada: 5 cambios» |
| CA-27 | `detail.test.ts` · «CA-27 inexistente → 404 NOT_FOUND sin datos» |
| CA-37 | `detail.test.ts` · «CA-37 job.title sale de getJobSummary (stub con título propio)»; `module-boundaries.test.ts` sin cambios y en verde; `ports.test.ts` · «DT-07 lector real: getJobSummary → status y title; inexistente → null» |
| CA-38 | Review (umbrales sobre el diff); B-01 deja la factoría ≤ 15 líneas |
| CA-39 · EC-08 · DD-03 | `advance.test.ts` · «CA-39 (DT-09, HU-06 lo revisa) activa de una oferta closed → advance 200 y StageChange interview → offer»; `reject.test.ts` · «DT-09 (HU-06 lo revisa) rechazar una activa de una closed → 200»; «DT-09 ni advance ni reject llaman al puerto de estado (espía vacío)» |
| DD-01 | `transitions.test.ts` · «decideAdvance: tabla completa etapa × esperada × destino», «decideReject: 6 × 6» |
| DD-02 | `stage-repository.test.ts` · «updateStage con stage desfasado → undefined y fila intacta»; `stage-change-adversarial.test.ts` · «DD-02 findById desfasado → 409 STAGE_MISMATCH sin StageChange» |
| EC-06, EC-15, EC-17, EC-12 | `stage-change-adversarial.test.ts` · «EC-06 dos pestañas → STAGE_MISMATCH», «EC-15 rechazo y avance en paralelo → un 200 y un 409, 1 StageChange», «EC-17 nota con HTML y SQL guardada literal», «EC-12 NUL y U+0007 → 400; \n\r\t aceptados» |
| EC-19, EC-21, EC-22, EC-23 | `detail-adversarial.test.ts` · «EC-19 abc, 0, ?x=1 → 400», «EC-21 getJobSummary lanza / candidates renombrada → 500 sin datos», «EC-22 sin nombre → 500, sin inventarlo», «EC-23 0 claves email ni phone» |
| RNF-01, RNF-02 | `performance.test.ts` · «RNF-01 advance y reject < 500 ms con 1 000 candidatos y 2 000 inscripciones», «RNF-02 detalle con 5 cambios < 200 ms» |
| CA-02, CA-13, CA-22, CA-23, CA-28, CA-36, CA-40 | N/A en API: web y e2e (TD-frontend); la API que usan la cubren CA-01, CA-12, CA-24 y CA-27 |

**Adversariales** (≥ 1 por RF Must): B-06 (RF-01, RF-02: entrada hostil, concurrencia, guarda, fallos inyectados) y
B-07 (RF-02, RF-03: privacidad y detalle).

## Riesgos

| Riesgo | Probabilidad (1–5) | Impacto (1–5) | Mitigación |
|---|---|---|---|
| Techo de 15 tareas con las adversariales: el backend estima **7** (5 + 2 `[adversarial]`), así que la web y el e2e disponen de **8** | 3 | 4 | Sin piezas especulativas. Si la web necesitara 9, B-01 se funde con B-02 (L) y el backend queda en 6. No se parte la HU |
| DT-09: la API mueve inscripciones de ofertas cerradas hasta HU-06 | 3 | 2 | Tests con «HU-06 lo revisa» en el nombre (DD-03); la web no ofrece la acción |
| Reloj que retrocede: `now()` < `created_at` rompe el `CHECK` (500) o deja el historial con fechas no crecientes | 1 | 2 | Aceptado: reloj del sistema en producción y relojes de test que solo avanzan |
| `service.ts` supera 300 líneas | 2 | 2 | Previsto ~210; si no, `advance`/`reject` a `stage-change.ts` (DD-06) |
| Dobles del puerto desfasados al añadir `getJobSummary` | 2 | 1 | `app.ts` y el tipado de los dobles fallan al compilar (DD-04) |

## Open Decisions

No hay (OD-01 resuelta → DD-10).

## Fuera de scope

- `JobApplicationsPort` real, UC-19, UC-04 · A1, rechazo con `job_closed` y el recálculo al cerrar: HU-06 (DT-01), que
  además revisa DT-09.
- Retroceder, deshacer, editar motivo o nota, notas en avances, borrar inscripciones (RV-18, RV-19, RV-21, S-16).
- Vaciar la nota al anonimizar y el resto de RGPD §7 (feature A); `SELECT *` de `recalculateRetention` (DP-02).
- Paginar el historial o el pipeline (S-18); cambios de esquema o de seed.

## Checklist de implementación (base de `/task-planner`)

| # | Tarea | Tamaño | Ficheros principales |
|---|---|---|---|
| B-01 | RF-09: casos de uso a funciones de módulo y factoría que solo compone, **sin cambio de comportamiento** (suites de HU-04 en verde antes de seguir); `transitions.ts` y `stageMismatch()`; DD-01 | M | `applications/service.ts`, `applications/transitions.ts`, `src/errors.ts`, `applications/transitions.test.ts` |
| B-02 | Lecturas y guarda: `findById`, `updateStage` (`WHERE … AND stage = ?` + `RETURNING`), `listHistory`; `getJobSummary` (`ports.ts`, `jobs/job-status.ts`, `findSummaryById`); *helpers* de test; literal de `privacy-logs.test.ts` | M | `applications/{repository,ports}.ts`, `jobs/{job-status,repository}.ts`, `test/helpers/applications.ts`, `stage-repository.test.ts`, `ports.test.ts`, `privacy-logs.test.ts` |
| B-03 | `POST /api/applications/:id/advance`: `advanceBodySchema`, `advance` + `applyStageChange`, ruta; CA-01, 03 a 08, 10, 39, EC-03 (DD-10), EC-04, EC-10, espía de DT-09; test RV-23 con esperada desactualizada y destino = actual (`interview`) → 200 sin escrituras (DD-05) | L | `applications/{schemas,service,routes}.ts`, `advance.test.ts` |
| B-04 | `POST /api/applications/:id/reject`: `rejectBodySchema`, `trimNote`, `reject`, ruta; CA-12, 14 a 19, EC-13, EC-16, EC-18, DT-09 en el rechazo; test RV-23 sobre una `rejected` con esperada desactualizada y motivo y nota distintos → 200 sin escrituras, motivo y nota intactos (DD-05) | L | `applications/{schemas,service,routes}.ts`, `reject.test.ts` |
| B-05 | `GET /api/applications/:id`: `applicationDetailSchema`, `getDetail` (DD-08), ruta; CA-24 a 27 (API), CA-37, EC-20, EC-22 (`job_closed`); RNF-01 y RNF-02 | M | `applications/{schemas,service,routes}.ts`, `detail.test.ts`, `performance.test.ts` |
| B-06 | [adversarial] Avanzar y rechazar: CA-09, CA-11, CA-20, EC-01, 02, 05, 06, 09 (403), 11, 12, 14, 15, 17; DD-02 | L | `stage-change-adversarial.test.ts`, `stage-change-failures-adversarial.test.ts` |
| B-07 | [adversarial] Privacidad y detalle: CA-21, RNF-04, RNF-05, EC-09 (logs), EC-19, 21, 22, 23 | M | `stage-change-privacy.test.ts`, `detail-adversarial.test.ts` |

Orden: B-01 → B-02 → B-03 → B-04 → B-05 → (B-06, B-07). El contrato de este documento basta para que la web empiece en
paralelo con B-03.
