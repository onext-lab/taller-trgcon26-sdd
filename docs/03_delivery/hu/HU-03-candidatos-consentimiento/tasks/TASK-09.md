# TASK-09 — Piezas compartidas de la web (movidas de ofertas) y cliente de candidatos [setup] [refactor]

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (base de RF-01 a RF-06 en la web)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
Dos partes (DD-03 del TD-frontend):

1. **Mover a `apps/web/src/components/`** las piezas de `jobs` que candidatos necesita, **sin cambiar el
   comportamiento de ofertas**: `jobs` las importa desde allí y **re-exporta sus nombres públicos**, así que sus tests
   no se tocan.
   - `list-controls.ts` (de `jobs/list-query.ts`): `DEFAULT_PAGE_SIZE`, `PAGE_SIZES`, `totalPages`,
     `hasControlCharacter`, `validateFilterText(raw, { maxLength, tooLong, control })` y `validateSearchText` con sus
     textos.
   - `Pagination.tsx` (de `JobPagination.tsx`): `<nav aria-label="Paginación">` con «Página N de M (X {noun})»; los
     pasos «Anterior»/«Siguiente» los pinta `renderStep(target, label)` (enlace en ofertas, botón en candidatos).
   - `PageSizeSelect.tsx` (de `JobFilters.tsx`): selector «Por página» (20, 50, 100) con `value` y `onChange(size)`.
   - `form-errors.ts` (de `job-form-errors.ts`): `splitValidationDetails(error, isField)` y
     `focusFirstError(form, order, errors)`, genéricos.
   - `use-document-title.ts` (de `JobDetailScreen.tsx`): `useDocumentTitle(title | null)` → «{title} · ATS».
   - `use-lifetime-signal.ts` (de `use-job-actions.ts`), sin cambios.
   - `router.tsx`: `parseRouteId(text)` (regla de `parseJobId`) y el aviso `'Candidato creado.'` en `NoticeText` y
     `NOTICES`.
   - `http.ts`: `ApiErrorDetail.existingId?: number`, que `toEnvelopeError` conserva solo si es entero seguro > 0.
   - `format.ts`: `formatCalendarDate('2027-04-06')` → «06/04/2027», sin zona horaria; otro formato → «Fecha no
     válida».
   - **No se mueven** `useReturnFocus`, `splitServerError` de ofertas, `NotFound`, `ConfirmDialog` ni `StatusMessages`.
2. **Cliente de candidatos** en `apps/web/src/features/candidates/`: `types.ts` (S1-S4), `api.ts` (6 llamadas,
   `isCandidate`, `isCandidatePage`, `candidateListUrl`), `paths.ts` (`candidatePaths`, `parseCandidateId`) y
   `consent.ts` (`CONSENT_TEXT`, `CONSENT_VERSION = 'v1'`, `consentStatus`, `consentSummary`).

Si la tarea pasa de 4 h, el cliente de candidatos (`types.ts`, `api.ts`, `paths.ts`, `consent.ts` y `api.test.ts`) se
va al principio de TASK-10, sin crear tarea nueva (riesgo del TD-frontend).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/components/list-controls.ts` | crear | Sale de `jobs/list-query.ts` (~70 líneas) |
| `apps/web/src/components/Pagination.tsx` | crear | Sale de `JobPagination.tsx`, con `renderStep` (~45) |
| `apps/web/src/components/PageSizeSelect.tsx` | crear | Sale de `JobFilters.tsx` (~30) |
| `apps/web/src/components/form-errors.ts` | crear | `splitValidationDetails`, `focusFirstError` (~45) |
| `apps/web/src/components/use-document-title.ts` | crear | Sale de `JobDetailScreen.tsx` (~15) |
| `apps/web/src/components/use-lifetime-signal.ts` | crear | Sale de `use-job-actions.ts` (~20) |
| `apps/web/src/components/router.tsx` | modificar | `parseRouteId`; aviso «Candidato creado.» |
| `apps/web/src/components/http.ts` | modificar | `existingId` en `ApiErrorDetail` |
| `apps/web/src/components/format.ts` | modificar | `formatCalendarDate` |
| `apps/web/src/features/jobs/list-query.ts` | modificar | Importa y re-exporta lo movido |
| `apps/web/src/features/jobs/JobPagination.tsx` | modificar | Envoltorio de `Pagination` con enlaces; mismo texto y props |
| `apps/web/src/features/jobs/JobFilters.tsx` | modificar | Usa `PageSizeSelect` |
| `apps/web/src/features/jobs/job-form-errors.ts` | modificar | Delega en `components/form-errors.ts`; misma API |
| `apps/web/src/features/jobs/use-job-actions.ts` | modificar | Importa `useLifetimeSignal` |
| `apps/web/src/features/jobs/JobDetailScreen.tsx` | modificar | Importa `useDocumentTitle` |
| `apps/web/src/features/jobs/JobFormScreen.tsx` | modificar | Importa `useDocumentTitle` si fija el título |
| `apps/web/src/features/jobs/paths.ts` | modificar | `parseJobId` sobre `parseRouteId` |
| `apps/web/src/features/candidates/types.ts` | crear | `Candidate`, `CandidateListItem`, `CandidatePage`, `CandidateInput`, `CandidatePatch` |
| `apps/web/src/features/candidates/api.ts` | crear | `listCandidates`, `getCandidate`, `createCandidate`, `updateCandidate`, `registerConsent`, `withdrawConsent`, guardas de forma, `candidateListUrl` |
| `apps/web/src/features/candidates/paths.ts` | crear | `candidatePaths`, `parseCandidateId` |
| `apps/web/src/features/candidates/consent.ts` | crear | `CONSENT_TEXT`, `CONSENT_VERSION`, `consentStatus`, `consentSummary` |
| `apps/web/test/components/list-controls.test.ts` | crear | Reglas de `q` y del texto de filtro |
| `apps/web/test/components/Pagination.test.tsx` | crear | Texto, `renderStep` con enlace y con botón |
| `apps/web/test/components/form-errors.test.ts` | crear | Reparto de `details` y foco |
| `apps/web/test/components/http.test.ts` | modificar | `existingId` válido, ausente y no válido |
| `apps/web/test/components/format.test.ts` | modificar | `formatCalendarDate` |
| `apps/web/test/components/router.test.tsx` | modificar | Aviso «Candidato creado.» y `parseRouteId` |
| `apps/web/test/features/candidates/api.test.ts` | crear | URLs, métodos, cuerpos y respuestas con forma inesperada |

## Implementa
- RF: base de RF-01 a RF-06 (web) · Supuestos S1-S10 · Edge cases: respuesta 2xx con forma inesperada
  (`CLIENT_BAD_RESPONSE`), EC-51 (solo `formatCalendarDate`)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Enfoque técnico, § Dependencias (S1-S10), § Módulos y ficheros
  afectados (transversal, jobs, `types.ts`, `api.ts`, `paths.ts`, `consent.ts`), DD-03, DD-04, DD-06, § Checklist W1

## Dependencias
- **Depende de:** nada (los tests simulan `fetch`; el contrato lo fija el TD-backend)
- **Bloquea:** TASK-10, TASK-11, TASK-12

## Criterios de done
- [ ] **Ofertas sin regresión:** `npm test -w @ats/web -- jobs` en verde **sin modificar ningún fichero de
      `apps/web/test/features/jobs/`** (19 ficheros, los mismos que antes).
- [ ] `npm test -w @ats/web -- components` en verde (8 ficheros: los 5 actuales y los 3 nuevos).
- [ ] `npm test -w @ats/web -- candidates/api` en verde (1 fichero): cada llamada usa su método y URL
      (`/api/candidates?q=…` con `encodeURIComponent`; consentimiento sin cuerpo ni `Content-Type`); una respuesta 2xx
      con forma inesperada da `CLIENT_BAD_RESPONSE`.
- [ ] `http.test.ts`: `existingId: 42` se conserva; ausente, `0`, `-1`, `1.5` o `"42"` → se descarta.
- [ ] `format.test.ts`: `formatCalendarDate('2027-04-06')` → «06/04/2027»; `'2027-4-6'` → «Fecha no válida».
- [ ] `consent.ts`: `CONSENT_TEXT` es literal el de DT-01 y `CONSENT_VERSION === 'v1'`.
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] e2e de ofertas sin regresión: `npx playwright test e2e/jobs.spec.ts e2e/jobs-list.spec.ts e2e/jobs-lifecycle.spec.ts`
      en verde.
- [ ] Ningún fichero tocado pasa de 300 líneas ni ninguna función de 50.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components apps/web/src/features/jobs apps/web/src/features/candidates apps/web/test/components apps/web/test/features/candidates`
      sin errores.
- [ ] Commit único `refactor(web): share list and form pieces; add candidates client [HU-03 TASK-09]` nombrando los
      ficheros.

## Notas de implementación
- **Texto del consentimiento (DT-01)**, literal: «El candidato consiente que conservemos sus datos durante 24 meses
  para tenerle en cuenta en futuros procesos de selección. Puede retirar este consentimiento en cualquier momento.»
- `consentStatus(c)`: `'active'` si `consentGivenAt !== null && consentWithdrawnAt === null`; `'withdrawn'` si las dos
  no son nulas; `'none'` si no. `consentSummary` devuelve los textos de la tabla de `ConsentSection` del TD-frontend
  (vigente, retirado, nunca dado) con `formatDate` para los instantes.
- `api.ts`: cuerpo del alta y de la edición tal cual le llegue (lo construye el modelo del formulario en TASK-11);
  `registerConsent(id)` → `POST /api/candidates/{id}/consent`; `withdrawConsent(id)` →
  `POST /api/candidates/{id}/consent/withdrawal`; los dos sin cuerpo (como las acciones de ofertas).
- `candidateListUrl({ q, skill, page, pageSize })`: omite `q` y `skill` vacíos y `page`/`pageSize` por defecto.
- `isCandidate` comprueba los 11 campos de S1; `isCandidatePage`, `{ items, total, page, pageSize }` con elementos que
  traen `id`, `fullName`, `email` y `skills` (S3).
- `parseRouteId`: entero positivo seguro, solo dígitos (misma regla que `parseJobId`).
- El orden importa: primero mover y dejar `jobs` en verde; después crear `candidates/`.
