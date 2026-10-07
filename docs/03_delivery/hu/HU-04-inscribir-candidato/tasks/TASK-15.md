# TASK-15 — Recorrido e2e de inscripción [e2e]

## Metadata
- **HU:** HU-04 · **Feature:** FEAT-03
- **Scope:** test
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-07, RF-08, RF-10)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
El recorrido de Playwright (Chromium) de la HU contra la API y la web reales, con el seed nuevo. Nuevo fichero
`e2e/applications.spec.ts`. Cada test prepara sus datos por API (`page.request`): una oferta publicada y un candidato
con *token* único (`@example.com`, sin teléfono), como `e2e/candidates.spec.ts`. **Nunca cierra una oferta con
inscripciones** (DT-10).

Tests:
- «CA-02, CA-14 y CA-19 inscribir desde el pipeline»: ficha de la oferta → «Ver pipeline» → URL `/jobs/{id}/pipeline` y
  título «Pipeline de la oferta · ATS»; estado vacío con «Inscribir candidato»; abrir el panel, buscar por parte del
  nombre, «Inscribir» → «Candidato inscrito.» y la tarjeta con su nombre la primera de «Recibida»; ficha del candidato
  → «Fin de retención: Mientras dure el proceso».
- «CA-02 buscar por parte del email e inscribir» (segundo candidato propio).
- «CA-08 inscribir a uno ya inscrito → "Este candidato ya está inscrito en la oferta." sin enlace y ninguna tarjeta
  nueva».
- «CA-26 draft por URL y closed del seed»: borrador creado en el test → mensaje de borrador, sin columnas ni «Inscribir
  candidato»; una `closed` buscada con `GET /api/jobs?status=closed` (sin IDs fijos) → columnas sin «Inscribir
  candidato».
- «RNF-05 y EC-45 la búsqueda no sale del panel»: tras buscar por email, `page.url()`, `page.title()` y `history.state`
  (con `page.evaluate`) sin el email.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/applications.spec.ts` | crear | Recorridos de RF-07, RF-08 y RF-10 |

## Implementa
- RF: RF-07, RF-08, RF-10 · RNF: RNF-05 · CA: CA-02, CA-08, CA-14, CA-19, CA-26 · Edge cases: EC-28, EC-39, EC-45
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Estrategia de tests (columna Playwright y párrafo «e2e»), § Checklist W6

## Dependencias
- **Depende de:** TASK-01 a TASK-09 (toda la API: rutas, migración `003`, seed y puerto de procesos real), TASK-11,
  TASK-13
- **Bloquea:** nada

## Criterios de done
- [ ] `npx playwright test e2e/applications.spec.ts` en verde.
- [ ] `npm run e2e` completo en verde (el seed de 40 inscripciones no rompe los e2e de ofertas ni de candidatos).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint e2e/applications.spec.ts` sin errores.
- [ ] `e2e/applications.spec.ts` ≤ 300 líneas tras Prettier.
- [ ] Commit único `test(e2e): enroll a candidate from the job pipeline [HU-04 TASK-15]`.

## Notas de implementación
- **El `tsconfig` de `e2e/` no tiene `dom`:** URL con `page.url()`, título con `page.title()`, `history.state` con
  `page.evaluate` y un *cast* mínimo de `globalThis` (patrón de `e2e/candidates-list.spec.ts`); nada de `window` ni
  `document` tipados.
- Consultas por rol y nombre accesible (las 6 `region`, `status`, `alert`); sin esperas fijas.
- La base es compartida entre specs: nombres con *token* único y ningún ID fijo del seed.
- `playwright.config.ts` arranca API y web propias (`reuseExistingServer: false`); no hace falta `npm run dev`.
- Datos inventados (`@example.com`), sin teléfono.
