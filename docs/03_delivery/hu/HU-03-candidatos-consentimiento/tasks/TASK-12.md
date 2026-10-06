# TASK-12 — Ficha de candidato y sección de consentimiento en la web

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-05, RF-06 web; RNF-06, RNF-07, RNF-09)
- **Complejidad:** L (2–4 h; estimada 4 h)

## Descripción
Pantalla `/candidates/:id`:
- `CandidateDetailScreen.tsx`: valida el ID con `parseCandidateId` antes de pedir nada (`/candidates/abc` → «Candidato
  no encontrado» sin petición); `key={id}` en el cargador; estados cargando, error con «Reintentar», no encontrado y con
  datos; `CandidateNotFound`; título fijo «Ficha de candidato · ATS» (o «Candidato no encontrado · ATS»), **nunca** el
  nombre, que sí va en el h1 (DD-08).
- `CandidateDetails.tsx`: h1 con `fullName` (`tabIndex={-1}`) y `<dl>` (Email, Teléfono, Resumen `pre-wrap`, Skills,
  Fecha de alta en `<time>`, Fin de retención con `formatCalendarDate`; `null` → «Mientras dure el proceso»);
  opcionales vacíos → «Sin indicar». Todo como texto JSX.
- `ConsentSection.tsx`: `<section aria-labelledby>` con h2 «Consentimiento para futuros procesos», resumen
  (`consentSummary`), texto de DT-01, «Versión del texto: v1.», casilla «El candidato da su consentimiento» que
  **refleja lo guardado** (DD-05), «Renovar consentimiento» solo con uno vigente y `ConfirmDialog` de retirada.
- `use-consent-actions.ts`: registrar, renovar y retirar; estado, guarda de doble envío (`useRef` + `disabled`),
  errores y foco por `ref` al control que lanzó la acción (DD-12).
- `App.tsx`: ruta `/candidates/:id` (después de `/candidates/new`). `styles.css`: sección de consentimiento y casilla.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/candidates/CandidateDetailScreen.tsx` | crear | Contenedor y `CandidateNotFound` (~140) |
| `apps/web/src/features/candidates/CandidateDetails.tsx` | crear | h1 y `<dl>` (~70) |
| `apps/web/src/features/candidates/ConsentSection.tsx` | crear | Sección, casilla, «Renovar» y diálogo (~130) |
| `apps/web/src/features/candidates/use-consent-actions.ts` | crear | Acciones de consentimiento (~130) |
| `apps/web/src/App.tsx` | modificar | Ruta `/candidates/:id` con título fijo |
| `apps/web/src/styles.css` | modificar | Sección de consentimiento (contraste ≥ 4,5:1) |
| `apps/web/test/features/candidates/CandidateDetailScreen.test.tsx` | crear | CA-22, CA-23, CA-24, EC-35, EC-36, EC-37 |
| `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx` | crear | CA-25 a CA-28, EC-43 |

## Implementa
- RF: RF-05, RF-06 (web) · CA: CA-01 (ficha), CA-22 a CA-28 · Edge cases: EC-35, EC-36, EC-37, EC-43, EC-55 (texto
  con `retentionEndsAt: null`)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Ficha y Sección de consentimiento, § Accesibilidad
  que usan los tests, DD-04, DD-05, DD-08, DD-12, § Estrategia de tests (RF-05, RF-06), § Checklist W4

## Dependencias
- **Depende de:** TASK-03 (`GET /:id`), TASK-04 (los dos `POST` de consentimiento), TASK-09 (piezas y cliente)
- **Bloquea:** TASK-14, TASK-15

## Criterios de done
- [ ] CA-22: ficha completa con los tres estados del consentimiento: vigente «Vigente: otorgado el {dd/mm/aaaa} con la
      versión {v} del texto.», casilla marcada y «Renovar consentimiento» visible; retirado «Retirado el {dd/mm/aaaa}.
      Se otorgó el {dd/mm/aaaa} con la versión {v} del texto.», casilla desmarcada y sin «Renovar»; nunca dado «No
      consta consentimiento para futuros procesos.».
- [ ] EC-36: solo nombre y email → «Sin indicar» en teléfono, resumen y skills, sin `null` ni huecos;
      2026-10-06T22:30:00Z → 07/10/2026. CA-01: fin de retención `2027-04-06` → «06/04/2027».
- [ ] `retentionEndsAt: null` → «Mientras dure el proceso».
- [ ] CA-23 / EC-35: 404, 400 o `/candidates/abc` → h1 «Candidato no encontrado», «El candidato que buscas no
      existe.» y «Volver a los candidatos»; `/candidates/abc` sin petición.
- [ ] CA-24 / EC-37: red caída → `role="alert"` y «Reintentar», sin datos a medias.
- [ ] CA-25: marcar → `POST /api/candidates/{id}/consent` sin cuerpo, casilla `disabled` y «Registrando el
      consentimiento…» en curso; al terminar, «Consentimiento registrado.», fecha, versión y nuevo fin de retención.
- [ ] CA-26 / EC-43: desmarcar → `dialog` «¿Retirar el consentimiento?» con foco en «Cancelar» y el aviso de que la
      retención se recalcula y puede quedar vencida; «Cancelar» o `Escape` (`simulateCancel`) → sin petición y nada
      cambia; «Retirar» → `POST …/consent/withdrawal` y «Consentimiento retirado.» con la fecha pasada mostrada igual.
- [ ] CA-27: «Renovar consentimiento» → `POST …/consent`, «Renovando…» `disabled` y «Consentimiento renovado.».
- [ ] CA-28: sin consentimiento vigente la casilla está desmarcada: marcarla registra (`/consent`), nunca retira.
- [ ] Foco: tras cada acción (éxito, error o cierre del diálogo) vuelve a la casilla o a «Renovar» (si desaparece, a la
      casilla), por `ref`.
- [ ] `document.title` es «Ficha de candidato · ATS» con el nombre en pantalla (RNF-09).
- [ ] `npm test -w @ats/web -- CandidateDetailScreen` en verde, con **2** ficheros de test.
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/candidates/CandidateDetailScreen.tsx apps/web/src/features/candidates/CandidateDetails.tsx apps/web/src/features/candidates/ConsentSection.tsx apps/web/src/features/candidates/use-consent-actions.ts apps/web/src/App.tsx apps/web/test/features/candidates/CandidateDetailScreen.test.tsx apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx`
      sin errores.
- [ ] Commit único `feat(web): candidate detail with consent section [HU-03 TASK-12]` nombrando los ficheros.

## Notas de implementación
- Texto del diálogo (literal del TD-frontend): título «¿Retirar el consentimiento?»; descripción «Se guardará la fecha de
  retirada y se conservarán la de otorgamiento y la versión. La fecha de fin de retención se recalculará sin el
  consentimiento y puede quedar ya vencida.»; botones «Cancelar» (foco inicial) y «Retirar»; `busy` mientras se envía;
  un error se queda dentro del diálogo (`error`), como el cierre de ofertas.
- **Éxito** → `setData(respuesta)` (resumen, casilla y fin de retención nuevos) y `role="status"` en la sección.
  **Error de registrar o renovar** → `role="alert"` en la sección con `userMessage(error)`; la ficha no cambia. Sin
  actualización optimista (DD-05).
- La versión que se muestra como **aceptada** es siempre `consentVersion` de la respuesta; `CONSENT_VERSION` solo
  acompaña al texto de la casilla (DD-04).
- Enlaces «Editar» (a `/candidates/:id/edit`) y «Volver a los candidatos»; el aviso de llegada («Candidato creado.»,
  «Cambios guardados.») con `StatusMessages`.
- No uses `useReturnFocus` de ofertas ni `document.activeElement` (deuda HU-02 §9.3, DD-12).
- Polyfill de `<dialog>` en `apps/web/test/helpers/dialog.ts`; `mockFetch` con URL exacta.
- Los casos hostiles de la ficha y del consentimiento (doble clic, 404/500, HTML, forma inesperada) van en TASK-14.

## Reapertura · review ronda 1 (curado) (2026-10-06)
- **Origen:** `review/REVIEW.md` (ronda 1, curado de observaciones antes del merge), §9.
- **Qué hay que hacer:** Gate de QUALITY-GATES (≤ 50 líneas por función): `ConsentSection` tiene 57 y `useConsentActions` 56. Pártelos (p. ej. un subcomponente para el diálogo de retirada y un hook auxiliar para el foco) sin cambiar el comportamiento. Corrige además las etiquetas de ID de `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx`: `:119` y `:198` dicen CA-24/CA-26 y prueban el fallo del consentimiento (CA-30); `:258` y `:270` dicen CA-28 y prueban la protección de la casilla en la web (pon «EC-49» o una descripción sin ID equivocado).
- **Ficheros:** `apps/web/src/features/candidates/ConsentSection.tsx`, `apps/web/src/features/candidates/use-consent-actions.ts` (y uno nuevo si extraes), `apps/web/test/features/candidates/CandidateDetailScreen.consent.test.tsx`
- **Criterios de done:** `ConsentSection` y `useConsentActions` ≤ 50 líneas cada una (max-lines-per-function con skipBlankLines y skipComments); `npm test -w @ats/web -- CandidateDetailScreen` en verde; typecheck y eslint de los ficheros tocados a 0.
