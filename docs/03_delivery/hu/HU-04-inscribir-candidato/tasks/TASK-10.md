# TASK-10 — Contrato de inscripciones en la web y piezas compartidas (`reload`, `Notice` con `ref`) [setup]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (base de RF-07 y RF-08)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
Nace `apps/web/src/features/applications/` con el contrato de la API (S1-S6 del TD-frontend, cruzados con el
TD-backend) y dos cambios pequeños en piezas compartidas. Sin pantallas todavía y **sin dependencias nuevas**.

1. **`applications/types.ts`**: `STAGES` (`received`, `screening`, `interview`, `offer`, `hired`, `rejected`), `Stage`,
   `REJECTION_REASONS` (`not_a_fit`, `candidate_withdrew`, `other`, `job_closed`), `RejectionReason`,
   `PipelineJobStatus` (`draft` | `published` | `closed`), `PipelineItem` (`{ id, candidateName, stage, lastChangeAt,
   rejectionReason }`), `Pipeline` (`{ job: { id, status }, items: PipelineItem[] }`; la clave es **`items`**),
   `EnrollmentInput` (`{ jobId, candidateId }`) y `Application` (los 6 campos del 201).
2. **`applications/paths.ts`**: `PIPELINE_ROUTE = '/jobs/:id/pipeline'`, `pipelinePath(jobId)` y
   `parsePipelineJobId(path)` (sobre `matchPath` y `parseRouteId` de `apps/web/src/components/router.tsx`).
3. **`applications/labels.ts`**: `stageLabel` (Recibida, Cribado, Entrevista, Oferta, Contratado, Rechazado),
   `rejectionReasonLabel` («No encaja con el perfil», «Retirada del candidato», «Otro», «Oferta cerrada», DT-07 g) y
   `groupByStage(items)` → `Record<Stage, PipelineItem[]>` con las 6 claves siempre, **en el orden recibido** (DD-08).
4. **`applications/api.ts`**: `pipelineUrl(jobId)` (`RangeError` con un ID no válido); `isPipeline` (comprueba `job`,
   `items`, etapa y motivo conocidos y `rejectionReason` no nulo si y solo si `rejected`); `getPipeline(jobId,
   signal)` (forma inesperada o `job.id` distinto → `badResponseError`); `isApplication`; `enrollCandidate(input,
   signal)` (`POST /api/applications` con `requestJson`, cuerpo `JSON.stringify({ jobId, candidateId })`);
   `SEARCH_LIMIT = 10` y `searchCandidates(q, signal)` = `listCandidates({ q, pageSize: SEARCH_LIMIT }, signal)`
   (importa solo el cliente público de `apps/web/src/features/candidates/api.ts`, DD-01).
5. **`applications/enroll-errors.ts`**: `classifyEnrollError(error)` → `'duplicate' | 'not-published' | 'not-found' |
   'other'` por `code` de `ApiError` (`DUPLICATE`, `INVALID_TRANSITION`, `NOT_FOUND`), y los textos fijos de DD-05:
   «Este candidato ya está inscrito en la oferta.» y «La oferta ya no está publicada: no admite inscripciones.».
6. **`apps/web/src/components/use-resource.ts`** (DD-04): `reload()` vuelve a pedir **sin** pasar por `loading` (los
   datos siguen hasta que llega la respuesta; un error pasa a `error`). `retry` y `setData` no cambian.
7. **`apps/web/src/components/StatusMessages.tsx`**: `Notice` acepta `ref` opcional (prop de React 19) y, si lo recibe,
   `tabIndex={-1}`, para poder enfocarlo.
8. **Tests**:
   - `apps/web/test/features/applications/fixtures.ts` (nuevo, solo datos): pipelines inventados (`published` con
     tarjetas en las 6 etapas y motivos, `published` vacía, `draft`, `closed`) y páginas de candidatos (`@example.com`)
     de 0, 10 y 11 resultados (`total > 10`). `renderPipeline` llega en TASK-11.
   - `apps/web/test/features/applications/api.test.ts`: URL exacta del pipeline; `RangeError`; `isPipeline` rechaza etapa
     o motivo desconocidos, `job.id` distinto y falta de `items` (EC-37); cuerpo exacto `{"jobId":7,"candidateId":12}`
     y `Content-Type: application/json` (EC-01, EC-02); `isApplication` con los 6 campos; `searchCandidates('ana')` →
     `/api/candidates?q=ana&pageSize=10` y `searchCandidates('')` → `/api/candidates?pageSize=10`;
     `classifyEnrollError` con los 4 casos.
   - `apps/web/test/features/applications/labels.test.ts`: las 6 etiquetas de etapa, las 4 de motivo y `groupByStage`
     (orden recibido, columnas vacías presentes).
   - `apps/web/test/components/use-resource.test.tsx`: «`reload` mantiene el dato mientras pide y luego lo sustituye»;
     «un error de `reload` pasa a `error`».

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/types.ts` | crear | Tipos del contrato (S1, S2, S4, S5) |
| `apps/web/src/features/applications/paths.ts` | crear | `PIPELINE_ROUTE`, `pipelinePath`, `parsePipelineJobId` |
| `apps/web/src/features/applications/labels.ts` | crear | Etiquetas y `groupByStage` |
| `apps/web/src/features/applications/api.ts` | crear | Cliente del pipeline, de inscribir y búsqueda |
| `apps/web/src/features/applications/enroll-errors.ts` | crear | `classifyEnrollError` y textos fijos |
| `apps/web/src/components/use-resource.ts` | modificar | `reload()` (DD-04) |
| `apps/web/src/components/StatusMessages.tsx` | modificar | `Notice` con `ref` y `tabIndex={-1}` |
| `apps/web/test/features/applications/fixtures.ts` | crear | Datos inventados del pipeline y del buscador |
| `apps/web/test/features/applications/api.test.ts` | crear | Cliente, forma, URL, errores |
| `apps/web/test/features/applications/labels.test.ts` | crear | Etiquetas y agrupación |
| `apps/web/test/components/use-resource.test.tsx` | modificar | Tests de `reload` |

## Implementa
- RF: base de RF-07 y RF-08 · Edge cases: EC-01, EC-02 (lado web), EC-37 (forma inesperada)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Dependencias (S1-S6), § Módulos y ficheros afectados, DD-01, DD-04,
  DD-05, DD-08, § Checklist W1

## Dependencias
- **Depende de:** nada (el contrato de la API está fijado en `plans/TECHNICAL_DOC-backend.md`; los tests simulan `fetch`)
- **Bloquea:** TASK-11

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications components/use-resource` en verde, con **3** ficheros de test.
- [ ] `npm test -w @ats/web -- features/jobs features/candidates` en verde **sin tocar** sus tests (`useResource` y
      `Notice` son compartidos).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/types.ts apps/web/src/features/applications/paths.ts apps/web/src/features/applications/labels.ts apps/web/src/features/applications/api.ts apps/web/src/features/applications/enroll-errors.ts apps/web/src/components/use-resource.ts apps/web/src/components/StatusMessages.tsx apps/web/test/features/applications/fixtures.ts apps/web/test/features/applications/api.test.ts apps/web/test/features/applications/labels.test.ts apps/web/test/components/use-resource.test.tsx`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier.
- [ ] Commit único `feat(web): applications client and shared reload/notice pieces [HU-04 TASK-10]`.

## Notas de implementación
- **DD-01 (dirección `jobs → applications → candidates`):** `applications` no importa nada de `features/jobs/`; la API
  pública de una feature es `api.ts`, `types.ts` y `paths.ts`.
- `reload()`: incrementa el intento sin poner `loading`; reutiliza el `AbortController` del efecto, así una respuesta
  vieja nunca pisa a la nueva. No toques `retry` ni `setData`.
- `existingId` del 409 se ignora en esta HU (el enlace es de HU-05); `apps/web/src/components/http.ts` no cambia.
- Si el contrato cambiara, solo se tocan `types.ts`, `api.ts` y `labels.ts`.
- `mockFetch` (`apps/web/test/helpers/fetch.ts`) compara la URL exacta con su query.
