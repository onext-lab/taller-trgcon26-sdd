# HU-05 — Pipeline con cambio de etapa e historial — PRD

## Info
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** fullstack
- **Módulos:** `inscripciones` (código `applications`), `ofertas` (código `jobs`: la operación `getJobSummary` del lector
  `job-status.ts` y «Ver pipeline» en una oferta cerrada) y `candidatos` (código `candidates`: solo se invoca su
  `recalculateRetention`, sin cambios de código previstos)
- **Fecha:** 2026-10-07 (Open Questions resueltas el 2026-10-07)
- **Estado:** Ready

## Contexto

### Problema
El reclutador ya inscribe candidatos y ve el pipeline (HU-04), pero no puede moverlos: no avanza etapas, no rechaza ni
consulta el historial de una inscripción. Mientras no se cierren inscripciones, la retención de esos candidatos queda
«mientras dure el proceso» para siempre (RGPD §3, S-06). HU-05 lleva a cada candidato hasta la contratación o el
rechazo con rastro de cada decisión. El cierre de una oferta con inscripciones activas (UC-19, UC-04 · A1) pasa a HU-06
por el corte de DT-01.

### Situación actual
HU-05 va en secuencia tras HU-01..HU-04, ya en `main` y en la rama `hu/HU-05-pipeline-etapas`.
- **Esquema ya listo, sin migración nueva:** `apps/api/src/db/migrations/003-create-applications.sql` crea
  `applications` y `stage_changes` con el `CHECK` de transiciones (INV-04), de motivo (`not_a_fit`,
  `candidate_withdrew`, `other`, `job_closed`; INV-07) y de nota (1-500, solo en `rejected`; INV-10), los dos únicos
  parciales (un cambio inicial y uno final por inscripción) y los *triggers* de inmutabilidad del historial (todo
  `UPDATE` y `DELETE` abortan salvo `SET note = NULL`, DT-12 de HU-04). El `UPDATE` de `applications` está libre.
- **API de `inscripciones`** (`apps/api/src/modules/applications/`): `routes.ts` registra solo `POST /api/applications` y
  `GET /api/jobs/:jobId/applications`; no hay `GET /api/applications/:id` ni rutas de transición. `service.ts` expone
  `enroll` y `getPipeline`; `createApplicationsService` (líneas 52-112) supera el umbral de 50 líneas (aviso de la review
  de HU-04: sacar helpers antes de añadir avanzar y rechazar). `repository.ts` no tiene lectura por ID, actualización de
  etapa ni lectura del historial. `insertApplicationWithHistory` (`apps/api/src/db/seed-applications.ts`) escribe un
  historial paso a paso para el seed y los tests.
- **Puertos que ya usa `inscripciones`:** `JobStatusPort` (solo el estado de la oferta; lo implementa
  `apps/api/src/modules/jobs/job-status.ts`) y `CandidateLookupPort` (`exists`, `findNames`, columnas explícitas), en
  `apps/api/src/modules/applications/ports.ts`. Ninguno da el **título** de la oferta, que la cabecera del detalle
  necesita (DT-04 de HU-04). `recalculateRetention` (`apps/api/src/modules/candidates/service.ts`) se une a la
  transacción en curso; lee la ficha con `SELECT *` (DP-02, deuda abierta para la feature A).
- **Puerto hacia `inscripciones` (de HU-06):** `JobApplicationsPort` (`apps/api/src/modules/jobs/applications-port.ts`)
  sigue con el stub `noJobApplications` en `apps/api/src/app.ts`; el diálogo de cierre dice 0 y cerrar deja abiertas
  las inscripciones (ventana de INV-05, DT-10 de HU-04, que **sigue abierta hasta HU-06**). HU-05 no lo toca.
- **Web** (`apps/web/src/features/applications/`): `PipelineBoard.tsx` pinta tarjetas con el nombre como texto (sin
  enlace), «Último cambio» y el motivo; ninguna tarjeta tiene acciones. `PipelineScreen.tsx` muestra una `closed` con
  columnas y sin «Inscribir candidato». `api.ts` solo tiene `getPipeline` y `enrollCandidate`; `paths.ts` solo la ruta del
  pipeline; `labels.ts` ya tiene las etiquetas de etapa y de motivo. El 409 `DUPLICATE` se pinta como texto en
  `EnrollPanel.tsx` y `use-enrollment.ts` ignora `existingId`. No hay ruta `/applications/:id` en `apps/web/src/App.tsx`.
- **Ficha de la oferta:** `apps/web/src/features/jobs/JobActions.tsx` ofrece «Ver pipeline» solo en `published`; a una
  `closed` solo se llega al pipeline por URL.
- **Piezas reutilizables:** `withTransaction` (`apps/api/src/db/transaction.ts`), `apps/api/src/errors.ts`
  (`notFound`, `invalidTransition`, `duplicate`), el manejador de errores y `rejectBody` (`apps/api/src/http/`), los
  dobles de `apps/api/test/helpers/applications.ts` y `apps/api/test/helpers/test-app.ts`, `failWrites` (tests de
  `apps/api/test/applications/enroll-failures-adversarial.test.ts`); en la web, `useResource.reload`
  (`apps/web/src/components/use-resource.ts`), `formatDate` (`apps/web/src/components/format.ts`),
  `ConfirmDialog.tsx`, `router.tsx` y `expectFocusOn` (`apps/web/test/helpers/focus.ts`).
- **Ficheros al límite de 300 líneas:** `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` (300): los tests
  nuevos de la ficha van a un fichero hermano.

### Resultado esperado
Desde el pipeline de una oferta publicada, cada tarjeta en etapa no final ofrece «Avanzar a {etapa}» (con la etapa
esperada; hacia `hired`, con confirmación) y «Rechazar» (diálogo con motivo de lista y nota opcional con aviso); el
nombre de cada tarjeta abre el detalle de la inscripción (`/applications/:id`) con su etapa actual y su historial. El
409 de inscripción duplicada enlaza a la inscripción existente. Una oferta cerrada muestra su pipeline en solo lectura y
se abre desde su ficha. Pasar a `hired` o `rejected` recalcula la retención del candidato en la misma transacción. La
ventana de INV-05 sigue abierta hasta HU-06 (DT-01).

**Tamaño estimado** (techo de 15 tareas **con** las `[adversarial]`, QUALITY-GATES §2; DT-11): unas 10 tareas más 3-4
`[adversarial]`, 13-14 en total. Cabe.

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-15 · P | Avanzar a la etapa siguiente con la etapa esperada; `StageChange` sin motivo ni nota | CA-01, CA-02 |
| UC-15 · A1 | Reintento de un avance ya aplicado → 200 sin cambios | CA-03 |
| UC-15 · A2 | Contratar: confirmación, etapa final, oferta intacta, retención recalculada si era la última abierta; segundo `hired` permitido | CA-04, CA-05, CA-40 |
| UC-15 · E1 | Etapa esperada desactualizada → 409 `STAGE_MISMATCH` | CA-06 |
| UC-15 · E2 | Salto, retroceso o `rejected` por esta vía → 409 `INVALID_TRANSITION` | CA-07 |
| UC-15 · E3 | Inscripción en etapa final → 409 | CA-08 |
| UC-15 · E4 | Petición mal formada → 400 | CA-09 |
| UC-15 · E5 | Inscripción inexistente → 404 | CA-10 |
| UC-15 · E6 | Falla una escritura → nada cambia | CA-11 |
| UC-16 · P | Rechazar con motivo y nota (aviso), retención recalculada; nota fuera de logs, errores y pipeline | CA-12, CA-13, CA-21 |
| UC-16 · A1 | Reintento de un rechazo → 200, conserva motivo y nota originales | CA-14 |
| UC-16 · E1 | Motivo ausente, fuera de la lista o «oferta cerrada» → 400 | CA-15 |
| UC-16 · E2 | Nota de 501 tras recortar → 400; solo espacios = sin nota; la nota no sale en el error | CA-16, CA-21 |
| UC-16 · E3 | Etapa esperada desactualizada → 409 | CA-17 |
| UC-16 · E4 | Inscripción contratada → 409 | CA-18 |
| UC-16 · E5 | Inscripción inexistente → 404 | CA-19 |
| UC-16 · E6 | Falla una escritura → nada cambia | CA-20 |
| UC-17 · P (acciones «Avanzar» y «Rechazar» y acceso al historial del paso 5) | Acciones por etapa y enlace al detalle en cada tarjeta | CA-22 |
| UC-17 · A1 | Oferta cerrada: pipeline en solo lectura, con el historial accesible | CA-23 |
| UC-18 · P | Detalle con etapa actual e historial del más antiguo al más reciente | CA-24 |
| UC-18 · A1 | Inscripción recién creada: un único `StageChange` sin origen | CA-25 |
| UC-18 · A2 | Rechazo manual con motivo y nota; rechazo por cierre (seed) con «oferta cerrada» y sin nota | CA-26 |
| UC-18 · E1 | Inscripción inexistente → 404 y «Página no encontrada» | CA-27 |
| UC-18 · E2 | API no disponible → estado de error útil | CA-28 |
| UC-19 · P, A1, A2, E1, E2 (movido a HU-06) | Rechazo de las activas al cerrar | CA-29 a CA-35 (movidos a HU-06) |
| UC-04 · A1 (movido a HU-06) | Cierre con inscripciones activas | CA-29, CA-31 (movidos a HU-06) |

Ficheros: `docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md` y
`docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md`. La columna CA de su «Trazabilidad» se rellena
con el PRD aprobado. `docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md` y
`docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md` (A1) pasan a HU-06 (DT-01); `hu.md` lo actualiza el
`product-owner`.

Flujos de esos UC que **no** cubre esta HU: UC-17 · P en los pasos 1-4 y «Inscribir candidato», A2, E1 y E2 (HU-04);
UC-17 · A3 (feature A, S-05); UC-19 entero y UC-04 · A1 (HU-06, DT-01); UC-04 · P, A2, A3, E1 y E2 (HU-02).

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | Avanzar una inscripción por API (UC-15) | Must | backend | - [ ] `POST /api/applications/:id/advance` con `{ expectedStage, toStage }`, estricto (DEC-11.1): las dos etapas admiten las 6 etapas (otra → 400); `:id` como texto con `pattern` (DEC-11.2) (DT-02)<br>- [ ] Orden (DT-02): 403 → cuerpo y esquema (400) → existencia (404) → reintento: `toStage` = etapa actual y es `screening`, `interview`, `offer` o `hired` → 200 sin `StageChange` ni cambio de fechas (RV-23, prevalece sobre RV-22) → etapa esperada ≠ actual → 409 `STAGE_MISMATCH` → destino que no es la etapa inmediatamente siguiente (salto, retroceso, `received`, `rejected` aunque sea la actual, o inscripción final) → 409 `INVALID_TRANSITION` (RV-19; DT-03) → escrituras<br>- [ ] Dentro de una `withTransaction` (`BEGIN IMMEDIATE`): lectura de la inscripción, `UPDATE` de `stage` y `last_change_at` con la guarda de la etapa actual en el `WHERE` (0 filas → 409, convención SEC-02), `INSERT` del `StageChange` (origen, destino, instante del reloj inyectado, sin motivo ni nota) y, si el destino es `hired`, `recalculateRetention(candidateId)` de `candidatos` (RN-10); cualquier error hace `ROLLBACK` de todo<br>- [ ] 200 con la `Application` de 6 campos (sin nota ni datos del candidato), también en el reintento (DT-02)<br>- [ ] **No comprueba el estado de la oferta** (DT-09): una inscripción activa de una oferta `closed` (ventana de INV-05) se avanza<br>- [ ] Contratar no toca otras inscripciones del candidato ni el estado de la oferta; se admite más de un `hired` por oferta (RV-24, S-17)<br>- [ ] Inexistente → 404 sin datos; ningún `message`, `details` ni log lleva datos del candidato (DP-01)<br>- [ ] Hereda la guarda `CROSS_SITE_REQUEST` (DEC-12) |
| RF-02 | Rechazar una inscripción por API (UC-16) | Must | backend | - [ ] `POST /api/applications/:id/reject` con `{ expectedStage, reason, note? }`, estricto (DT-02)<br>- [ ] `reason` obligatorio entre `not_a_fit`, `candidate_withdrew` y `other`; `job_closed` o cualquier otro → 400 (S-15)<br>- [ ] Nota recortada antes de validar (S-03, DEC-11.3): vacía → `null`; más de 500 puntos de código tras recortar → 400; admite `\n`, `\r` y `\t` y rechaza el resto de C0 y DEL con 400 (DEC-11.8, DT-02); el 400 no repite la nota (DEC-11.4)<br>- [ ] Orden (DT-02): 403 → 400 → 404 → ya `rejected` → 200 sin `StageChange` y conservando motivo y nota originales, con cualquier etapa esperada (RV-23, S-01) → esperada ≠ actual → 409 `STAGE_MISMATCH` → `hired` → 409 `INVALID_TRANSITION` → escrituras<br>- [ ] En una `withTransaction`: `UPDATE` con guarda, `INSERT` del `StageChange` con motivo y nota, y `recalculateRetention(candidateId)`; cualquier error hace `ROLLBACK` de todo<br>- [ ] 200 con la `Application` de 6 campos; no comprueba el estado de la oferta (DT-09)<br>- [ ] La nota nunca aparece en logs, mensajes de error, `details` ni en la respuesta del rechazo (RGPD §6.1; RNF-04) |
| RF-03 | Detalle de una inscripción con su historial por API (UC-18; era RF-06 de HU-04) | Must | backend | - [ ] `GET /api/applications/:id` (DT-01 de HU-04), `:id` como texto con `pattern` y sin parámetros de consulta (DT-07)<br>- [ ] Respuesta `{ id, stage, createdAt, lastChangeAt, candidate: { id, fullName }, job: { id, title, status }, history: [{ fromStage, toStage, changedAt, reason, note }] }`, todo con `additionalProperties: false` (DT-07); historial del más antiguo al más reciente (orden por `id`), origen nulo en el inicial, motivo y nota solo en el de rechazo<br>- [ ] Nada más del candidato: ni email ni teléfono (RGPD §6.2); el nombre por `findNames`; la oferta por `getJobSummary(id)` → `{ status, title } \| null`, operación que define `applications` en `ports.ts` e implementa `apps/api/src/modules/jobs/job-status.ts` con `SELECT status, title` (DEC-06, DT-07), sin `SELECT *` (DP-02)<br>- [ ] Inexistente → 404 `NOT_FOUND` sin datos; error de un puerto → 500 sin datos |
| RF-04 (movido a HU-06) | Rechazo de las inscripciones activas al cerrar una oferta (`JobApplicationsPort` real) | — | — | Movido a HU-06 por el corte de DT-01 |
| RF-05 | Acciones «Avanzar» y «Rechazar» en las tarjetas del pipeline (UC-17 · P paso 5, UC-15, UC-16) | Must | frontend | - [ ] En una oferta `published`, cada tarjeta en etapa no final ofrece «Avanzar a {etapa siguiente}» y «Rechazar»; las de `hired` y `rejected`, ninguna acción (RV-19, DT-04)<br>- [ ] «Avanzar» envía la etapa siguiente y, como esperada, la etapa de la tarjeta (RV-22); sin confirmación, salvo «Avanzar a Contratado», que abre un `ConfirmDialog` («¿Contratar a este candidato? No se puede deshacer.», «Cancelar» con el foco inicial y «Contratar») (DT-04)<br>- [ ] Una petición por clic (control deshabilitado mientras vuela)<br>- [ ] Éxito, también el 200 de un reintento: «Inscripción avanzada a {etapa}.» con `role="status"`, el foco va al aviso y el pipeline se recarga con `reload()` (DT-06)<br>- [ ] 409 `STAGE_MISMATCH`: «La inscripción ha cambiado de etapa: revisa el pipeline actualizado.»; 409 `INVALID_TRANSITION`: «La inscripción ya no admite ese cambio.»; 404: «La inscripción ya no existe.»; los tres con `role="alert"` y recarga; textos en la web, no los de la API (DT-06). Red, 400, 403 o 500: `userMessage` sin recarga ni *stack trace*<br>- [ ] Los botones tienen nombre accesible que identifica la tarjeta (sin poner el nombre en la URL ni en el título)<br>- [ ] Recorrido e2e: avanzar una inscripción creada en el test hasta `hired` y verla en «Contratado» |
| RF-06 | Formulario de rechazo en la web (UC-16 · P) | Must | frontend | - [ ] «Rechazar» abre un diálogo modal (`<dialog>`, como `ConfirmDialog`) «Rechazar la inscripción»: grupo de radios con `<legend>` «Motivo» y las opciones «No encaja con el perfil», «Retirada del candidato» y «Otro», ninguna marcada (nunca «Oferta cerrada»); «Nota (opcional)» en un `<textarea>` con contador «N/500» y el aviso «No incluyas datos sensibles (salud, origen, ideología, religión…) ni nada que no sea necesario para la decisión.»; botones «Cancelar» (foco inicial) y «Rechazar» (DT-05)<br>- [ ] Validación en el cliente (sin petición): motivo ausente, nota de más de 500 caracteres tras recortar (puntos de código, `Array.from`) y caracteres de control salvo `\n`, `\r` y `\t`; errores junto al campo<br>- [ ] Envía la etapa esperada de la tarjeta; una petición por envío<br>- [ ] Éxito: se cierra, «Inscripción rechazada.» con `role="status"` y foco en él, recarga; la tarjeta aparece en «Rechazado» con el motivo y **sin la nota** (DT-06)<br>- [ ] «Cancelar» o `Escape` descartan motivo y nota y devuelven el foco a «Rechazar»<br>- [ ] Error de red o 500: el diálogo sigue abierto con lo escrito y un mensaje con `role="alert"`; 409 y 404 con los textos de RF-05, el diálogo se cierra y el pipeline se recarga<br>- [ ] La nota no va a la URL, al título, a `history.state` ni al almacenamiento del navegador |
| RF-07 | Detalle de la inscripción en la web y sus dos enlaces (UC-18; era RF-09 de HU-04) | Must | frontend | - [ ] Ruta `/applications/:id` en la tabla `ROUTES` de `apps/web/src/App.tsx` (DT-01 de HU-04); título del documento «Inscripción · ATS» (DT-04 de HU-04)<br>- [ ] Cabecera con el nombre del candidato (enlace a su ficha `/candidates/:id`) y el título de la oferta (enlace a su pipeline); etapa actual con su etiqueta (DT-04 de HU-04)<br>- [ ] Historial en lista ordenada, del más antiguo al más reciente: origen («—» en el inicial), destino y fecha `dd/mm/aaaa` en Europe/Madrid sin hora (`formatDate`); en el cambio de rechazo, motivo con su etiqueta y nota, si la hay<br>- [ ] Estados cargando, error con mensaje útil y «Reintentar», y con datos; ID no válido (sin petición) o 404 → «Página no encontrada», como el pipeline y las fichas (DD-09 de HU-04; DT-08); respuesta que no cumple el contrato → error<br>- [ ] El nombre de cada tarjeta del pipeline es un enlace a `/applications/:id` (DT-01 de HU-04), en ofertas `published` y `closed`<br>- [ ] El 409 `DUPLICATE` del panel «Inscribir candidato» muestra «Este candidato ya está inscrito en la oferta.» con el enlace «Ver la inscripción» a `/applications/{existingId}` (DT-02 de HU-04); sin `existingId`, sin enlace<br>- [ ] Nombre y nota siempre como texto; la URL solo lleva el ID<br>- [ ] Recorrido e2e: abrir el detalle desde la tarjeta y ver el historial con el rechazo, su motivo y su nota |
| RF-08 | Pipeline de una oferta cerrada en solo lectura y su acceso (UC-17 · A1) | Must | frontend | - [ ] En una `closed`: las seis columnas, sin «Avanzar», «Rechazar» ni «Inscribir candidato», con el nombre de cada tarjeta enlazado a su detalle; las acciones dependen del estado de la oferta, no solo de la etapa de la tarjeta (DT-09)<br>- [ ] La ficha de una oferta `closed` ofrece «Ver pipeline», mismo texto y primer control, como en `published` (`apps/web/src/features/jobs/JobActions.tsx`; DT-08); sus tests van en un fichero hermano de `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx`<br>- [ ] Recorrido e2e sobre una oferta `closed` del seed (buscada con `GET /api/jobs?status=closed`, sin IDs fijos): «Ver pipeline» → solo lectura → detalle de un rechazo «Oferta cerrada». Ningún e2e cierra ofertas con inscripciones (DT-10 de HU-04, hasta HU-06) |
| RF-09 | Avisos de las reviews de HU-02 y HU-04 | Should | fullstack | - [ ] Antes de añadir avanzar y rechazar, `createApplicationsService` se reparte en helpers y ninguna función nueva o modificada pasa de 50 líneas (QUALITY-GATES §2)<br>- [ ] Ningún fichero nuevo o modificado pasa de 300 líneas; los tests nuevos de `JobDetailScreen.actions` van a un fichero hermano<br>- [ ] Las lecturas nuevas sobre `candidates` usan columnas explícitas (DP-02); la deuda del `SELECT *` de `recalculateRetention` sigue abierta para la feature A |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Avanzar y rechazar | Rendimiento | Cada `POST` de avance o de rechazo < 500 ms con 1 000 candidatos y 2 000 inscripciones (`fastify.inject`, local; volúmenes de DT-07 e de HU-04, umbral de QUALITY-GATES §2) |
| RNF-02 | Detalle de la inscripción | Rendimiento | `GET /api/applications/:id` < 200 ms con un historial de 5 cambios (el máximo posible), 1 000 candidatos y 2 000 inscripciones |
| RNF-03 (movido a HU-06) | Cierre con inscripciones | — | — |
| RNF-04 | Datos personales en logs y errores | Privacidad | 0 apariciones de nombre, email, teléfono o nota de un candidato en los logs y en los cuerpos de error de los tests de avanzar, rechazar y detalle, incluidos los 500 provocados en cada escritura y en los puertos (DP-01) |
| RNF-05 | Minimización | Privacidad | La nota sale solo en `GET /api/applications/:id`; el pipeline sigue con exactamente 5 campos por elemento; las respuestas de avanzar y rechazar no llevan nota ni datos del candidato; el detalle lleva 0 claves `email` o `phone` |
| RNF-06 | Datos en el navegador | Privacidad | 0 nombres o notas en `document.title`, en la URL, en `history.state` o en el almacenamiento del navegador en el pipeline, el formulario de rechazo y el detalle |
| RNF-07 | HTML escapado | Seguridad | 0 usos de `dangerouslySetInnerHTML` en `apps/web/src/features/applications/`; un nombre y una nota con `<img src=x onerror=alert(1)>` se pintan como texto en la tarjeta, el formulario y el detalle |
| RNF-08 | Accesibilidad | Accesibilidad | 100 % de los controles del formulario con `<label>` (motivo como grupo con `<legend>`); acciones de cada tarjeta con nombre accesible distinto; avisos con `role="status"` y errores con `role="alert"`; foco al aviso tras avanzar o rechazar y de vuelta a «Rechazar» al cancelar (aserción con `expectFocusOn`); historial como lista ordenada |

## Modelo de datos
**Sin migración nueva:** el esquema de `003-create-applications.sql` ya admite todo lo que HU-05 escribe (DEC-03: no se
edita). Dueño: `inscripciones` (DEC-06).

| Tabla | Operación nueva | Notas |
|---|---|---|
| `applications` | `UPDATE stage, last_change_at` con la guarda de la etapa actual en el `WHERE` | Avanzar y rechazar; `last_change_at` = instante del cambio (INV-06) |
| `stage_changes` | `INSERT` de un cambio por paso | Avance sin motivo ni nota; rechazo manual con `not_a_fit`, `candidate_withdrew` u `other` y nota opcional. `job_closed` solo lo escribe el seed (y HU-06). Nunca `UPDATE` ni `DELETE` (INV-03, *triggers*) |
| `candidates` | `retention_ends_at`, solo a través de `recalculateRetention` | Único escritor: `candidatos` (S-06) |
| `job_openings` | Ninguna escritura | Lectura nueva de `status` y `title` por `getJobSummary` (DT-07) |

- **Datos personales:** el historial del proceso (RGPD §1) y la nota de rechazo, texto libre que puede identificar a la
  persona (RV-20).
- Lecturas nuevas: la inscripción por ID y su historial (índice `stage_changes_application_idx`); nada fuera de las
  tablas de `inscripciones` salvo por puertos.

## Interfaces / endpoints / pantallas
Errores en el envelope `{ error: { code, message, details? } }`.

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/applications/:id/advance` | Nuevo | Cuerpo `{ expectedStage, toStage }`. 200 `Application` · 400 `VALIDATION_ERROR` · 403 `CROSS_SITE_REQUEST` · 404 `NOT_FOUND` · 409 `STAGE_MISMATCH` · 409 `INVALID_TRANSITION` · 413 · 415 · 500 `INTERNAL_ERROR` (DT-02) |
| POST | `/api/applications/:id/reject` | Nuevo | Cuerpo `{ expectedStage, reason, note? }`. Mismos códigos (DT-02) |
| GET | `/api/applications/:id` | Nuevo | Detalle con historial (RF-03, DT-07). 200 · 400 · 404 · 500 |
| GET · POST | `/api/jobs/:id/close-preview` · `/api/jobs/:id/close` | Sin cambios en HU-05 | Con el stub; los conecta HU-06 (DT-01) |
| POST | `/api/applications` · GET `/api/jobs/:jobId/applications` | Sin cambios | — |
| Interno | `getJobSummary(id)` → `{ status, title } \| null` | Nuevo | Definida en `apps/api/src/modules/applications/ports.ts`, implementada en `apps/api/src/modules/jobs/job-status.ts`, conectada en `apps/api/src/app.ts` (DT-07) |
| Interno | `JobApplicationsPort` | Sin cambios (HU-06) | Sigue `noJobApplications` |
| Pantalla | Pipeline (`/jobs/:id/pipeline`) | Modificar | Acciones por tarjeta, formulario de rechazo, nombre enlazado, solo lectura en `closed` (RF-05, RF-06, RF-08) |
| Pantalla | Detalle de la inscripción (`/applications/:id`) | Nueva | RF-07, en `apps/web/src/features/applications/` |
| Pantalla | Ficha de la oferta (`/jobs/:id`) | Modificar | «Ver pipeline» también en `closed` (RF-08) |
| Pantalla | Panel «Inscribir candidato» | Modificar | Enlace «Ver la inscripción» en el 409 duplicado (RF-07) |
| Rutas web | `apps/web/src/App.tsx` (tabla `ROUTES`) | Modificar | Ruta nueva `/applications/:id` |

## Flujos de usuario
1. **Avanzar:** pipeline de una `published` → «Avanzar a Entrevista» → «Inscripción avanzada a Entrevista.» con el foco
   y la tarjeta en la columna siguiente.
2. **Contratar:** «Avanzar a Contratado» → diálogo «¿Contratar a este candidato? No se puede deshacer.» → «Contratar» →
   aviso y la tarjeta en «Contratado».
3. **Rechazar:** «Rechazar» → diálogo con motivo, nota opcional y el aviso → «Rechazar» → «Inscripción rechazada.» y la
   tarjeta en «Rechazado» con el motivo, sin la nota.
4. **Conflicto:** otra pestaña ya movió la inscripción → «La inscripción ha cambiado de etapa: revisa el pipeline
   actualizado.» y pipeline recargado.
5. **Consultar el historial:** nombre de la tarjeta → `/applications/:id` → cabecera, etapa actual e historial; desde la
   cabecera, a la ficha del candidato o al pipeline.
6. **Inscripción duplicada:** panel «Inscribir candidato» → 409 → «Ver la inscripción» → detalle de la existente.
7. **Oferta cerrada:** ficha de una `closed` → «Ver pipeline» → pipeline en solo lectura → detalle de cualquier tarjeta.

## Datos personales
- **Qué toca:** el historial del proceso de selección (`Application`, `StageChange`); la **nota de rechazo**, texto libre
  que puede identificar a la persona (RV-20); el nombre del candidato (lo lee por `findNames`, no lo copia); y
  `candidates.retention_ends_at`, a través de `recalculateRetention` (no se duplica la fórmula).
- **Para qué y base jurídica:** seguir y cerrar el proceso de selección; medidas precontractuales (art. 6.1.b) mientras
  haya una inscripción abierta (RGPD §2).
- **Cuánto tiempo:** pasar la última inscripción no final a `hired` o `rejected` recalcula la retención en la misma
  transacción: la más tardía entre cierre + 6 meses y consentimiento vigente + 24 meses (RGPD §3, S-06). El cierre de
  una oferta con inscripciones activas, y su recálculo, es de HU-06. La nota vive lo que viva el historial; vaciarla al
  anonimizar (el *trigger* ya lo permite, DT-12 de HU-04) es una cuestión abierta de la feature A (RGPD §5 y §7.3):
  **no se resuelve aquí**.
- **Minimización:** la nota es opcional, ≤ 500 caracteres, con aviso de no incluir datos sensibles, y solo se muestra en
  el detalle (RGPD §6.2); el pipeline, las respuestas de avanzar y rechazar y los listados no la llevan (RNF-05).
- **Qué NO aparece:** nombre, email, teléfono ni nota en logs, mensajes de error, `details`, `document.title`, URL,
  `history.state` ni almacenamiento del navegador (RGPD §6.1; RNF-04, RNF-06).
- **Datos de ejemplo:** inventados, con `@example.com`, teléfonos de la serie `+34 600 000 0xx` y notas no sensibles
  (RGPD §6.3).

## Edge cases
Categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3: 1 Input inválido · 2 Boundary · 3 Fallo de
dependencia · 4 Concurrencia · 5 Datos corruptos o legacy · 6 Seguridad · 7 Idempotencia. EC-07 y EC-24 a EC-30 se
movieron a HU-06 (DT-01).

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | Sin `expectedStage`, `toStage: "foo"`, etapa como número, cuerpo vacío o no JSON, o con un campo de más (`note`, `reason`) | 400 en el envelope; las claves no declaradas, agrupadas como `{ field: 'body' }` (DEC-11.4); nada cambia (UC-15 · E4) |
| EC-02 | RF-01 | 1 Input inválido | `:id` `abc`, `0`, `01` o de 16 dígitos | 400 `VALIDATION_ERROR` (DEC-11.2) |
| EC-03 | RF-01 | 2 Boundary | Recorrido completo `received → … → hired`; `:id` = `Number.MAX_SAFE_INTEGER` inexistente | 4 avances con 4 `StageChange` y fechas crecientes; 404 sin datos |
| EC-04 | RF-01 | 2 Boundary | Avance con destino `received` estando en `received`, o `rejected` estando en `rejected` | 409 `INVALID_TRANSITION`: nunca son destinos de un avance (DT-03) |
| EC-05 | RF-01 | 3 Fallo de dependencia | Falla el `UPDATE` de la inscripción, el `INSERT` del `StageChange` o, al contratar, el `UPDATE` de la retención (`failWrites`) | 500 `INTERNAL_ERROR` sin *stack*; etapa, historial y retención como antes (UC-15 · E6) |
| EC-06 | RF-01 | 4 Concurrencia | Dos pestañas: una avanza `screening → interview`; la otra pide `offer` con esperada `screening` | 409 `STAGE_MISMATCH`; nada cambia (UC-15 · E1) |
| EC-07 (movido a HU-06) | — | — | — | — |
| EC-08 | RF-01 | 5 Datos corruptos | Inscripción en `interview` de una oferta `closed` (ventana de INV-05: cerrada con el stub de HU-06 pendiente) | La API la avanza: 200 y `StageChange` (DT-09; lo fija CA-39). La web no ofrece la acción (EC-49). HU-06 revisa esta decisión |
| EC-09 | RF-01 | 6 Seguridad | 404, 409 y 500 del avance; `POST` con `Sec-Fetch-Site: cross-site` | Sin nombre, email ni teléfono en `message`, `details` ni log (RNF-04); 403 `CROSS_SITE_REQUEST` (DEC-12) |
| EC-10 | RF-01 | 7 Idempotencia | Reintento de un avance ya aplicado (incluido a `hired`) | 200 sin `StageChange`, `last_change_at` intacto y la retención sin cambios (UC-15 · A1) |
| EC-11 | RF-02 | 1 Input inválido | Sin motivo, `reason: "job_closed"`, `"foo"` o un número; nota que no es texto; un campo de más (`toStage`) | 400; nada cambia (UC-16 · E1) |
| EC-12 | RF-02 | 1 Input inválido | Nota con NUL o U+0007; nota con saltos de línea y tabuladores | 400 en el primer caso; se acepta en el segundo (DEC-11.8, DT-02) |
| EC-13 | RF-02 | 2 Boundary | Nota de 500 y de 501 caracteres tras recortar; 500 emojis; nota solo de espacios; nota con espacios alrededor | Se acepta, 400, se acepta (puntos de código), se guarda sin nota, se guarda recortada (UC-16 · E2) |
| EC-14 | RF-02 | 3 Fallo de dependencia | Falla el `UPDATE`, el `INSERT` del `StageChange` o el `UPDATE` de la retención | 500 sin *stack*; nada cambia (UC-16 · E6) |
| EC-15 | RF-02 | 4 Concurrencia | Rechazo y avance cruzados sobre la misma inscripción con la misma etapa esperada | El primero gana; el segundo, 409 `STAGE_MISMATCH` (RV-22) |
| EC-16 | RF-02 | 5 Datos corruptos | Inscripción del seed ya rechazada con `job_closed` (oferta cerrada) que recibe un rechazo manual | 200 sin cambios; conserva `job_closed` y sin nota (UC-16 · A1) |
| EC-17 | RF-02 | 6 Seguridad | Nota con `<script>`, comillas o `'; DROP TABLE` | Se guarda literal por sentencia preparada; solo sale en el detalle; nunca en logs ni en el 400 de nota larga (RNF-04) |
| EC-18 | RF-02 | 7 Idempotencia | Doble envío del rechazo con otro motivo y otra nota | El segundo, 200 sin `StageChange`; motivo y nota del primero (UC-16 · A1) |
| EC-19 | RF-03 | 1 Input inválido | `:id` `abc`, `0` o con parámetros de consulta | 400 |
| EC-20 | RF-03 | 2 Boundary | Inscripción con 1 cambio; con 5 (contratada); `:id` inexistente | Uno sin origen; cinco en orden; 404 sin datos |
| EC-21 | RF-03 | 3 Fallo de dependencia | `getJobSummary` o `findNames` lanzan | 500 sin datos |
| EC-22 | RF-03 | 5 Datos corruptos | Inscripción del seed rechazada por cierre; inscripción cuyo nombre no sale de `findNames` (imposible por la FK) | Motivo `job_closed` y nota `null`; 500 sin inventar un nombre (detalle en el diseño) |
| EC-23 | RF-03 | 6 Seguridad | Candidato con email, teléfono y nota | La respuesta lleva la nota y el nombre, nunca email ni teléfono (RNF-05) |
| EC-24 a EC-30 (movidos a HU-06) | — | — | — | — |
| EC-31 | RF-05 | 2 Boundary | Tarjetas en cada una de las 6 etapas | Acciones solo en las 4 no finales; en `offer`, «Avanzar a Contratado» con confirmación (DT-04) |
| EC-32 | RF-05 | 3 Fallo de dependencia | La API no responde al avanzar | `role="alert"` con `userMessage`, sin recarga; el botón vuelve a estar disponible |
| EC-33 | RF-05 | 4 Concurrencia | Otra pestaña ya avanzó o rechazó la tarjeta | 409 → texto de DT-06 con `role="alert"` y recarga |
| EC-34 | RF-05 | 6 Seguridad | Nombre con `<img onerror>` en el nombre accesible de los botones | Texto (RNF-07) |
| EC-35 | RF-05 | 7 Idempotencia | Doble clic en «Avanzar» | Una sola petición; si llegaran dos, la segunda da 200 sin cambios y la web lo trata como éxito (DT-06) |
| EC-36 | RF-06 | 1 Input inválido | Confirmar sin motivo; nota con un carácter de control distinto de `\n`, `\r` o `\t` | Error junto al campo, sin petición |
| EC-37 | RF-06 | 2 Boundary | Nota de 500 y 501 caracteres, 500 emojis, solo espacios | Se envía; error con el contador; se envía; se envía sin nota |
| EC-38 | RF-06 | 3 Fallo de dependencia | La API no responde al rechazar | El diálogo sigue abierto con motivo y nota, mensaje con `role="alert"` |
| EC-39 | RF-06 | 4 Concurrencia | 409 al rechazar porque la inscripción cambió | Texto de DT-06, el diálogo se cierra y el pipeline se recarga |
| EC-40 | RF-06 | 6 Seguridad | Nota con un email inventado o HTML | No va a la URL, al título, a `history.state` ni al almacenamiento; no se pinta en el pipeline; en el detalle, como texto |
| EC-41 | RF-06 | 7 Idempotencia | Doble clic en «Rechazar» del diálogo | Una sola petición |
| EC-42 | RF-07 | 1 Input inválido | URL `/applications/abc` | «Página no encontrada», sin petición (DT-08) |
| EC-43 | RF-07 | 2 Boundary | Cambio a las 23:30 UTC del 31/12; inscripción recién creada; 409 duplicado sin `existingId` | 01/01 del año siguiente; «—» → Recibida; mensaje sin enlace |
| EC-44 | RF-07 | 3 Fallo de dependencia | API caída o respuesta no JSON al abrir el detalle | Estado de error con mensaje útil y «Reintentar» (UC-18 · E2) |
| EC-45 | RF-07 | 5 Datos corruptos | Respuesta con una etapa o un motivo desconocidos | Estado de error (validación del contrato en la web, como `isPipeline`) |
| EC-46 | RF-07 | 6 Seguridad | Nombre y nota con `<img src=x onerror=alert(1)>`; título del documento | Texto (RNF-07); «Inscripción · ATS» sin nombre (RNF-06) |
| EC-47 | RF-08 | 2 Boundary | Oferta `closed` sin inscripciones | Estado vacío sin «Inscribir candidato» |
| EC-48 | RF-08 | 4 Concurrencia | La oferta se cierra en otra pestaña con el pipeline abierto | La recarga tras la siguiente acción deja el pipeline en solo lectura (hasta HU-06, esa acción se aplica: DT-09) |
| EC-49 | RF-08 | 5 Datos corruptos | Oferta `closed` con una tarjeta no final (ventana de INV-05) | Sin «Avanzar» ni «Rechazar»: las acciones dependen del estado de la oferta (DT-09) |
| EC-50 | RF-08 | 6 Seguridad | URL del pipeline abierto desde una ficha cerrada | Solo el ID de la oferta; título genérico (RNF-06) |

**Evaluación de las 7 categorías por RF Must** (EC o `N/A — motivo`):

| RF | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|----|---|---|---|---|---|---|---|
| RF-01 | EC-01, EC-02 | EC-03, EC-04 | EC-05 | EC-06 | EC-08 | EC-09 | EC-10 |
| RF-02 | EC-11, EC-12 | EC-13 | EC-14 | EC-15 | EC-16 | EC-17 | EC-18 |
| RF-03 | EC-19 | EC-20 | EC-21 | N/A — lectura síncrona en una sola conexión de `node:sqlite`: ve la foto confirmada | EC-22 | EC-23 | N/A — `GET` sin efectos |
| RF-05 | N/A — sin texto de entrada: destino y etapa esperada salen de los datos cargados | EC-31 | EC-32 | EC-33 | N/A — la web pinta lo que valida la API (`isPipeline`) | EC-34 | EC-35 |
| RF-06 | EC-36 | EC-37 | EC-38 | EC-39 | N/A — no persiste nada en el cliente | EC-40 | EC-41 |
| RF-07 | EC-42 | EC-43 | EC-44 | N/A — solo lectura; el detalle refleja la foto de la carga | EC-45 | EC-46 | N/A — solo lectura |
| RF-08 | N/A — sin entrada: solo cambia qué acciones se pintan | EC-47 | N/A — mismos estados de carga y error que el pipeline de HU-04 (CA-16 de HU-04), sin código nuevo | EC-48 | EC-49 | EC-50 | N/A — solo lectura |

RF-04 (movido a HU-06) no se evalúa aquí.

## Decisiones aplicables
- **DEC-01:** envelope de error en las rutas nuevas; TypeScript estricto; Vitest y Playwright (RF-01 a RF-03).
- **DEC-03:** sin migración nueva; el seed no cambia; datos de test inventados (Modelo de datos).
- **DEC-04:** sin login, un único rol «reclutador»; sin permisos por rol. La seguridad se centra en datos personales,
  inyección y enumeración (EC-09, EC-17, EC-23).
- **DEC-06 (aclarada en HU-04):** el título de la oferta llega por `getJobSummary`, que define `inscripciones` e
  implementa `jobs` por tipado estructural, conectada en `app.ts` (DT-07); la retención, por `recalculateRetention`
  dentro de la transacción. Test de fallo inyectado por cada efecto cruzado (EC-05, EC-14, EC-21) y `module-boundaries`
  (CA-37). `JobApplicationsPort` es de HU-06.
- **DEC-07:** 400 validación; 404 sin datos; 409 `STAGE_MISMATCH` por etapa esperada desactualizada (código que DEC-07
  ya cita) y 409 `INVALID_TRANSITION` por transición no permitida; 200 en el reintento idempotente (RF-01, RF-02; DT-02).
- **DEC-08:** control optimista con la etapa esperada; el estado se comprueba dentro de la transacción y la escritura
  lleva la guarda en el `WHERE`; RV-23 prevalece sobre RV-22 (RF-01, RF-02; EC-06, EC-15).
- **DEC-09:** instantes en UTC con el reloj inyectado; `dd/mm/aaaa` en Europe/Madrid en el detalle (RF-07; EC-43).
- **DEC-10:** no aplica a listados nuevos: el historial tiene como mucho 5 cambios y no se pagina; el pipeline sigue sin
  paginar (S-18).
- **DEC-11:** Ajv estricto sin coerción; IDs de `params` como texto con `pattern`; recorte de la nota y vacía → `null`
  (11.3); `details` acotado y sin el valor recibido (11.4); la nota admite `\n`, `\r` y `\t` (11.8, DT-02);
  `withTransaction` (11.7).
- **DEC-12:** los `POST` de avanzar y rechazar heredan la guarda `CROSS_SITE_REQUEST` (EC-09).
- **Decisiones de PRD anteriores que se respetan:** DT-01, DT-02 y DT-04 de HU-04 (ruta, enlaces y cabecera del detalle);
  DT-03 de HU-04 (pipeline de una `closed` sin «Inscribir candidato»); DD-09 del TD-frontend de HU-04 («Página no
  encontrada»); DT-10 de HU-04 (ventana de INV-05, ahora hasta HU-06); DT-12 de HU-04 (*trigger* del historial). DT-01,
  DT-02, DT-03 y DT-08 de HU-02 no se tocan (cierre, de HU-06).
- **Avisos de review:** DP-01 y DP-02 de HU-02 (RF-01 a RF-03, RNF-04, RF-09); `createApplicationsService` y ficheros de
  test al límite (RF-09). La sustitución del test de EC-14 de HU-02 pasa a HU-06.

## Fuera de scope
- **UC-19 entero y UC-04 · A1** (HU-06, DT-01): implementar `JobApplicationsPort` (conteo y rechazo `job_closed` con
  recálculo dentro de la transacción del cierre), sustituir el test de EC-14 de HU-02
  (`apps/api/test/jobs/close.test.ts:202`), el `npm run db:reset` tras su merge que cierra la ventana de INV-05, el aviso
  tras cerrar (decidido para HU-06 en DT-10) y revisar DT-09. Salen RF-04, RNF-03, CA-29 a CA-35 y EC-07 y EC-24 a
  EC-30.
- UC-17 · A3 (etiqueta «Candidato anonimizado»), el estado «anonimizado» y el destino de sus inscripciones: feature A
  (S-05).
- Vaciar la nota del rechazo al anonimizar y las demás cuestiones de `docs/RGPD.md` §7: feature A.
- Leer con columnas explícitas en `recalculateRetention` (DP-02, deuda abierta en `docs/05_modules/inscripciones/technical.md`):
  cuando la feature A lo toque.
- Retroceder de etapa, deshacer un cambio, editar el motivo o la nota, notas en los avances y borrar inscripciones
  (RV-19, RV-21, S-16, RV-18).
- Avanzar o rechazar desde el detalle de la inscripción: los disparadores de UC-15 y UC-16 son las tarjetas del pipeline.
- Comprobar el estado de la oferta al avanzar o rechazar (DT-09; HU-06 la revisa).
- Paginar el pipeline o el historial (S-18).
- Cambios de esquema (ninguna migración) y cambios en el seed.
- Inscribir desde la ficha del candidato o varios a la vez (S-19); exportación y CSV (features A y C).

## Open Questions

No hay preguntas abiertas.

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| DT-01 | (Corte; el responsable técnico: «Sí, sprint de 6 HU») UC-19 y UC-04 · A1 pasan a HU-06 «Cerrar una oferta con inscripciones activas», dentro del sprint-01. Sale RF-04 (`JobApplicationsPort` real) con RNF-03, CA-29 a CA-35 y EC-07 y EC-24 a EC-30, marcados «movido a HU-06» sin renumerar. La ventana de INV-05 (DT-10 de HU-04) sigue hasta HU-06, con el `db:reset` tras su merge y la sustitución del test de EC-14 de HU-02. `hu.md` lo actualiza el `product-owner` | Techo de 15 tareas por HU con las adversariales (DT-11) | Info, Contexto, Casos de uso, RF-04, RNF-03, Interfaces, Edge cases, Criterios de aceptación, Fuera de scope | 2026-10-07 |
| DT-02 | (OQ-01, ingeniería; responsable técnico, según la recomendación) `POST /api/applications/:id/advance` con `{ expectedStage, toStage }` y `POST /api/applications/:id/reject` con `{ expectedStage, reason, note? }`; etapas entre las 6 (otra → 400); `reason` entre `not_a_fit`, `candidate_withdrew` y `other`. 200 con la `Application` de 6 campos, también en el reintento. 409 `STAGE_MISMATCH` («La inscripción ha cambiado de etapa: recarga e inténtalo de nuevo.») si la esperada no coincide y 409 `INVALID_TRANSITION` para salto, retroceso, `rejected` por avance, final o `hired` al rechazar. Orden: 403 → 400 → 404 → reintento (200) → esperada (409 `STAGE_MISMATCH`) → transición (409 `INVALID_TRANSITION`) → escrituras. Nota recortada, vacía → `null`, ≤ 500 puntos de código, admite `\n`, `\r` y `\t` y rechaza el resto de C0 y DEL (DEC-11.8) | El diseño necesitaba el contrato; DEC-07 cita `STAGE_MISMATCH`; la web distingue los dos 409 | RF-01, RF-02, RF-06, Interfaces, Decisiones aplicables, EC-04, EC-06, EC-12, EC-15, CA-06, CA-07 | 2026-10-07 |
| DT-03 | (OQ-02, ingeniería; responsable técnico) En el avance, un destino `received` o `rejected` da siempre 409 `INVALID_TRANSITION`, aunque sea la etapa actual; el reintento de UC-15 · A1 solo aplica a `screening`, `interview`, `offer` y `hired` | UC-15 · A1 y E2 chocaban en esos dos casos; ningún avance legítimo los lleva | RF-01, EC-04, CA-07 | 2026-10-07 |
| DT-04 | (OQ-03, producto; el responsable técnico: «Todo según recomendación») Botón «Avanzar a {etapa siguiente}», sin confirmación salvo hacia `hired`: `ConfirmDialog` «¿Contratar a este candidato? No se puede deshacer.» con «Cancelar» (foco inicial) y «Contratar» | Avanzar es irreversible (RV-19) y `hired` es final y recalcula la retención | RF-05, Flujos 1-2, EC-31, CA-02, CA-40 | 2026-10-07 |
| DT-05 | (OQ-04, producto; el responsable técnico) Diálogo modal (`<dialog>`) «Rechazar la inscripción»: 3 motivos en radios con `<legend>` «Motivo», ninguno marcado; «Nota (opcional)» en `<textarea>` con contador «N/500» y el aviso «No incluyas datos sensibles (salud, origen, ideología, religión…) ni nada que no sea necesario para la decisión.»; «Cancelar» (foco inicial) y «Rechazar» | UC-16 fijaba campos y aviso, no la forma ni los textos | RF-06, RNF-08, Flujo 3, CA-13 | 2026-10-07 |
| DT-06 | (OQ-05, producto; el responsable técnico) Éxito: «Inscripción avanzada a {etapa}.» / «Inscripción rechazada.» (`role="status"`). 409 `STAGE_MISMATCH`: «La inscripción ha cambiado de etapa: revisa el pipeline actualizado.»; 409 `INVALID_TRANSITION`: «La inscripción ya no admite ese cambio.»; 404: «La inscripción ya no existe.»; los tres con `role="alert"` y recarga del pipeline. Un 200 de reintento es éxito. Textos en la web | Ni el UC ni la HU fijaban avisos ni errores | RF-05, RF-06, Flujos 1-4, EC-33, EC-35, EC-39 | 2026-10-07 |
| DT-07 | (OQ-06, ingeniería; responsable técnico) `GET /api/applications/:id` → `{ id, stage, createdAt, lastChangeAt, candidate: { id, fullName }, job: { id, title, status }, history: [{ fromStage, toStage, changedAt, reason, note }] }`, con `additionalProperties: false`. El título llega por `getJobSummary(id)` → `{ status, title } \| null` (`SELECT status, title`), definida en `apps/api/src/modules/applications/ports.ts` e implementada en `apps/api/src/modules/jobs/job-status.ts` | DT-04 de HU-04 pide el título; DEC-06 prohíbe leer `job_openings` desde `applications` | RF-03, Modelo de datos, Interfaces, EC-21, Decisiones aplicables | 2026-10-07 |
| DT-08 | (OQ-07, producto; el responsable técnico) (a) Detalle con ID no válido (sin petición) o inexistente → «Página no encontrada», como el pipeline y las fichas (DD-09 de HU-04); se acepta como el «estado de error» de UC-18 · E1. (b) La ficha de una `closed` ofrece «Ver pipeline», mismo texto y primer control que en `published` | Coherencia con HU-04; HU-04 dejó el enlace de la cerrada para HU-05 | RF-07, RF-08, EC-42, CA-23, CA-27 | 2026-10-07 |
| DT-09 | (OQ-08, ingeniería; responsable técnico) Avanzar y rechazar **no comprueban el estado de la oferta**: una inscripción activa de una oferta `closed` (ventana de INV-05, abierta hasta HU-06) se puede avanzar o rechazar por la API; la web no ofrece acciones en una `closed` (RF-08). **HU-06 debe revisar esta decisión a propósito** al cerrar la ventana. Lo fijan EC-08 y CA-39 | Los UC no lo piden; con HU-06 una `closed` no tendrá inscripciones no finales | RF-01, RF-02, RF-08, EC-08, EC-48, EC-49, CA-39, Fuera de scope | 2026-10-07 |
| DT-10 | (OQ-09, producto; el responsable técnico; **decidida para HU-06**) Tras cerrar una oferta con inscripciones, el aviso se mantiene en «Oferta cerrada.» y la respuesta sigue siendo el `Job` (DT-03 de HU-02); el resultado se ve en el pipeline | El número del diálogo puede quedar viejo (UC-04 · A1) | Ninguno en HU-05 (Fuera de scope); lo hereda el PRD de HU-06 | 2026-10-07 |
| DT-11 | (Responsable técnico) El techo de 15 tareas por HU **incluye** las `[adversarial]` (QUALITY-GATES §2, como en HU-03 y HU-04); corrige la nota de tamaño del borrador | Gate de `/task-planner` | Contexto (tamaño), DT-01 | 2026-10-07 |

## Criterios de aceptación

> **Correspondencia con `hu.md`** (2026-10-07): el `hu.md` de HU-05 tiene **26** criterios Dado/Cuando/Entonces y este PRD **33 CA activos** (CA-01..CA-40, menos los 7 movidos a HU-06). No es drift: el PRD parte varios criterios del `hu.md` en más de un CA (p. ej. UC-15 · P → CA-01 y CA-02; UC-16 · P → CA-12, CA-13 y CA-21) y añade CA-36 a CA-40, que no salen de un flujo de UC (enlace «Ver la inscripción», DEC-06, umbrales de líneas, DT-09 y la confirmación de «Avanzar a Contratado»). La tabla «Casos de uso» de este PRD da la correspondencia flujo → CA.

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-15 · P / RF-01 | Una inscripción en `screening` en una oferta `published` | Se pide avanzar a `interview` con la etapa esperada `screening` | 200 con la `Application`; está en `interview` con `last_change_at` = instante del reloj; hay un `StageChange` `screening → interview` con esa fecha en UTC, sin motivo ni nota |
| CA-02 | UC-15 · P / RF-05 | El pipeline de esa oferta | El reclutador pulsa «Avanzar a Entrevista» en la tarjeta | Ve «Inscripción avanzada a Entrevista.» con el foco en el aviso y la tarjeta en «Entrevista» (test de la web y e2e) |
| CA-03 | UC-15 · A1 / RF-01 | Una inscripción que ya avanzó de `screening` a `interview` | Llega un reintento a `interview` con la etapa esperada `screening` | 200 sin `StageChange` nuevo y sin cambiar `last_change_at` ni la retención |
| CA-04 | UC-15 · A2 / RF-01 | Una inscripción en `offer` de un candidato sin consentimiento y sin otras inscripciones abiertas | Se avanza a `hired` | Queda en `hired`; la oferta sigue `published`; `retention_ends_at` = día del cambio en Europe/Madrid + 6 meses, en la misma transacción |
| CA-05 | UC-15 · A2 / RF-01 | Un candidato con otra inscripción abierta en otra oferta, y otra inscripción de la misma oferta ya en `hired` | Una inscripción suya pasa a `hired` | La otra inscripción no cambia y su retención sigue sin fecha; la oferta admite el segundo `hired` |
| CA-06 | UC-15 · E1 / RF-01 | Una inscripción en `interview` | Llega un avance a `offer` con la etapa esperada `screening` | 409 `STAGE_MISMATCH`; etapa e historial sin cambios |
| CA-07 | UC-15 · E2 / RF-01 | Una inscripción en `screening` | Se pide avanzar a `offer`, a `received` o a `rejected` | 409 `INVALID_TRANSITION` en los tres; no cambia nada |
| CA-08 | UC-15 · E3 / RF-01 | Una inscripción en `hired` y otra en `rejected` | Se pide avanzarlas a otra etapa con su etapa como esperada | 409 `INVALID_TRANSITION`; no cambia nada |
| CA-09 | UC-15 · E4 / RF-01 | — | Llega un avance con una etapa desconocida, sin etapa esperada o con un campo de más (`note`) | 400 en el envelope; no cambia nada |
| CA-10 | UC-15 · E5 / RF-01 | Un ID de inscripción que no existe | Se pide avanzarla | 404 `NOT_FOUND` sin datos; no cambia nada |
| CA-11 | UC-15 · E6 / RF-01 | Un fallo inyectado en el `UPDATE` de la etapa, en el `INSERT` del `StageChange` y, al contratar, en el de la retención | Se avanza | 500 `INTERNAL_ERROR` sin *stack*; etapa, historial y retención como antes |
| CA-12 | UC-16 · P / RF-02 | Una inscripción en `interview`, última abierta de su candidato | Se rechaza con `not_a_fit`, una nota de 500 caracteres y la etapa esperada `interview` | 200; queda `rejected` con un `StageChange` que guarda ese motivo y esa nota; la retención se recalcula desde ese día |
| CA-13 | UC-16 · P / RF-06, RF-05 | El pipeline con esa inscripción | El reclutador pulsa «Rechazar», ve el aviso junto a la nota en el diálogo, elige «No encaja con el perfil», escribe la nota y pulsa «Rechazar» | Ve «Inscripción rechazada.» y la tarjeta en «Rechazado» con «Motivo: No encaja con el perfil» y sin la nota (test de la web y e2e) |
| CA-14 | UC-16 · A1 / RF-02 | Una inscripción ya `rejected` | Llega un reintento con otro motivo y otra nota | 200 sin `StageChange`; conserva motivo y nota originales |
| CA-15 | UC-16 · E1 / RF-02 | Una inscripción en `interview` | Se rechaza sin motivo, con un motivo fuera de la lista o con `job_closed` | 400; no cambia nada |
| CA-16 | UC-16 · E2 / RF-02 | Una inscripción en `interview` | Se rechaza con una nota de 501 caracteres tras recortar; y, en otro caso, con una nota solo de espacios | 400 sin la nota en el cuerpo de error y nada cambia; el segundo se guarda con la nota `null` |
| CA-17 | UC-16 · E3 / RF-02 | Una inscripción en `interview` | Llega un rechazo con la etapa esperada `screening` | 409 `STAGE_MISMATCH`; sigue en `interview` |
| CA-18 | UC-16 · E4 / RF-02 | Una inscripción en `hired` | Se intenta rechazarla con la etapa esperada `hired` | 409 `INVALID_TRANSITION`; no cambia nada |
| CA-19 | UC-16 · E5 / RF-02 | Un ID de inscripción que no existe | Se intenta rechazarla | 404 sin datos; no cambia nada |
| CA-20 | UC-16 · E6 / RF-02 | Un fallo inyectado en el `UPDATE`, en el `INSERT` del `StageChange` y en el de la retención | Se rechaza | 500 sin *stack*; etapa, historial y retención como antes |
| CA-21 | UC-16 · P, E2 / RF-02, RNF-04, RNF-05 | Una nota con un marcador inventado | Se rechaza con éxito, con nota larga (400) y con un fallo inyectado (500) | El marcador no aparece en ningún log, cuerpo de error, respuesta del rechazo ni del pipeline; solo en `GET /api/applications/:id` |
| CA-22 | UC-17 · P / RF-05, RF-07 | El pipeline de una oferta `published` con tarjetas en las 6 etapas | Lo abre el reclutador | Las tarjetas no finales ofrecen «Avanzar a {etapa}» y «Rechazar»; las de `hired` y `rejected`, no; el nombre de toda tarjeta es un enlace a `/applications/:id` |
| CA-23 | UC-17 · A1 / RF-08 | Una oferta `closed` con inscripciones (seed) | El reclutador pulsa «Ver pipeline» en su ficha | Ve las 6 columnas con solo el nombre de cada candidato, sin «Avanzar», «Rechazar» ni «Inscribir candidato», y puede abrir el detalle de cualquier tarjeta (test de la web y e2e) |
| CA-24 | UC-18 · P / RF-03, RF-07 | Una inscripción que avanzó de `received` a `screening` y luego a `interview` | El reclutador abre su detalle desde la tarjeta | Ve la cabecera (nombre enlazado a la ficha y título enlazado al pipeline), la etapa actual «Entrevista» y 3 cambios del más antiguo al más reciente, cada uno con origen, destino y fecha `dd/mm/aaaa` de Europe/Madrid; título del documento «Inscripción · ATS» |
| CA-25 | UC-18 · A1 / RF-03, RF-07 | Una inscripción recién creada | Se abre su detalle | Etapa «Recibida» y un único cambio «—» → Recibida con la fecha de inscripción |
| CA-26 | UC-18 · A2 / RF-03, RF-07 | Una inscripción rechazada a mano con nota y otra del seed rechazada por el cierre de su oferta | Se abre el detalle de cada una | En la primera, el cambio de rechazo muestra motivo y nota; en la segunda, «Oferta cerrada» y ninguna nota |
| CA-27 | UC-18 · E1 / RF-03, RF-07 | Un ID de inscripción que no existe | Se abre su detalle | La API responde 404 `NOT_FOUND` y la web muestra «Página no encontrada» (DT-08) |
| CA-28 | UC-18 · E2 / RF-07 | La API no responde | Se abre un detalle | Estado de error con mensaje útil y «Reintentar», sin *stack trace* |
| CA-29 (movido a HU-06) | UC-19 · P; UC-04 · A1 | — | — | — |
| CA-30 (movido a HU-06) | UC-19 · P | — | — | — |
| CA-31 (movido a HU-06) | UC-04 · A1 | — | — | — |
| CA-32 (movido a HU-06) | UC-19 · A1 | — | — | — |
| CA-33 (movido a HU-06) | UC-19 · A2 | — | — | — |
| CA-34 (movido a HU-06) | UC-19 · E1 | — | — | — |
| CA-35 (movido a HU-06) | UC-19 · E2 | — | — | — |
| CA-36 | RF-07 | El panel «Inscribir candidato» con un candidato ya inscrito | El reclutador pulsa «Inscribir» y luego «Ver la inscripción» | Ve «Este candidato ya está inscrito en la oferta.» y el enlace le lleva al detalle de la inscripción existente |
| CA-37 | RF-03 / DEC-06 | `apps/api/src/app.ts` con el lector de `jobs` conectado | Se pide un detalle y se ejecuta `apps/api/test/module-boundaries.test.ts` | El título sale de `getJobSummary`; no hay `import` entre módulos ni SQL sobre tablas ajenas |
| CA-38 | RF-09 | El código de la HU | Se revisan los umbrales | `createApplicationsService` y toda función nueva o modificada ≤ 50 líneas; todo fichero nuevo o modificado ≤ 300 |
| CA-39 | RF-01 / DT-09 | Una inscripción en `interview` de una oferta `closed` (ventana de INV-05: oferta cerrada con el stub, dejando la inscripción abierta) | Se pide avanzarla a `offer` con la etapa esperada `interview` | 200 y un `StageChange` `interview → offer`: la API no comprueba el estado de la oferta (test que HU-06 revisará a propósito) |
| CA-40 | UC-15 · A2 / RF-05 | Una tarjeta en «Oferta» | El reclutador pulsa «Avanzar a Contratado» y, en otro caso, cancela el diálogo | Al confirmar con «Contratar», la tarjeta pasa a «Contratado»; al cancelar, no se envía ninguna petición y el foco vuelve al botón |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.

---
v1.1 (2026-10-07): OQ-01 a OQ-09 resueltas (DT-02 a DT-10) y corte de UC-19 y UC-04 · A1 a HU-06 (DT-01); nota de tamaño
corregida (DT-11).
