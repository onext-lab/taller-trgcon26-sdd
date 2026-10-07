# TASK-15 — Recorridos e2e de etapas, detalle y oferta cerrada [e2e]

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** test
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-05, RF-06, RF-07, RF-08; recorre RF-01 a RF-03)
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
W7 del diseño: recorridos de Playwright contra la API y la web reales (base regenerada al arrancar,
`playwright.config.ts`; solo Chromium; un worker).

1. **`e2e/support/applications.ts`** (nuevo; no es `*.spec.ts`, Playwright no lo ejecuta, DD-11): saca de
   `e2e/applications.spec.ts` (líneas 8-59) `uniqueToken`, `createJobByApi`, `createCandidateByApi`, `pipelinePath` y
   `stageRegion`, y añade `enrollByApi(page, jobId, candidateId)` (hoy en línea en `:130-133`).
2. **`e2e/applications.spec.ts`** (modificar): importa los *helpers*; el test de la línea 126 «CA-08 inscribir a uno
   ya inscrito: el aviso fijo sin enlace…» pasa a **CA-36**: misma alerta exacta (`:143`), y el aserto «sin enlace» de
   `:144` se sustituye por: «Ver la inscripción» visible tras la alerta → clic → detalle de la inscripción existente
   (URL `/applications/{id}`, título «Inscripción · ATS»). El resto de tests no cambia.
3. **`e2e/pipeline-stages.spec.ts`** (nuevo, ~220): oferta publicada, candidato e inscripción propios con *token* único
   (por `page.request`):
   - «CA-02/CA-40/EC-03 avanzar de received a hired: Avanzar a Cribado, Entrevista y Oferta; Avanzar a Contratado →
     Cancelar (sigue en Oferta) → Contratar → tarjeta en Contratado sin acciones».
   - «CA-13 rechazar con motivo y nota de dos líneas → Inscripción rechazada. y tarjeta en Rechazado con el motivo y sin
     la nota».
   - «CA-24/CA-26 tarjeta → detalle con la etapa, el historial en orden, el rechazo, su motivo y su nota».
   - «EC-40 la nota no está en la URL, el título ni history.state» (`page.url()`, `page.title()`, `page.evaluate`).
   - «CA-27 /applications/999999999 → Página no encontrada».
4. **`e2e/pipeline-closed.spec.ts`** (nuevo, ~90; hermano para no pasar de 300 líneas): oferta `closed` del seed
   buscada con `GET /api/jobs?status=closed` (sin IDs fijos) → ficha → «Ver pipeline» → 6 columnas sin «Avanzar»,
   «Rechazar» ni «Inscribir candidato» → detalle de un rechazo «Oferta cerrada» sin nota; la URL solo lleva el ID y el
   título es «Pipeline de la oferta · ATS» (CA-23, CA-26, EC-50).

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `e2e/support/applications.ts` | crear | *Helpers* compartidos de alta por API |
| `e2e/applications.spec.ts` | modificar | Importa los *helpers* (líneas 8-59 salen); test de `:126` de CA-08 a CA-36 (`:144`) |
| `e2e/pipeline-stages.spec.ts` | crear | Avanzar, contratar, rechazar, detalle, EC-40, CA-27 |
| `e2e/pipeline-closed.spec.ts` | crear | Oferta cerrada del seed en solo lectura (hermano) |

## Implementa
- RF: RF-05, RF-06, RF-07, RF-08 (y RF-01 a RF-03 por la API real) · CA: CA-02, CA-13, CA-23, CA-24, CA-26, CA-27,
  CA-36, CA-40 · EC: EC-03, EC-40, EC-50 · RNF: RNF-06
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Estrategia de tests (columna Playwright y «e2e»), DD-11, § Checklist W7

## Dependencias
- **Depende de:** TASK-01 a TASK-08 (API completa), TASK-10, TASK-11, TASK-13
- **Bloquea:** nada

## Criterios de done
- [ ] `npx playwright test e2e/pipeline-stages.spec.ts e2e/pipeline-closed.spec.ts e2e/applications.spec.ts` en verde
      (3 ficheros; el número de tests coincide con los listados).
- [ ] `npm run e2e` en verde (suite completa; `e2e/jobs-lifecycle.spec.ts` ya adaptado en TASK-11).
- [ ] `npm run typecheck` sin errores (el `tsconfig` raíz incluye `e2e/` sin `dom`: nada de `window`/`document`
      tipados; el *cast* mínimo de `globalThis` como en `e2e/applications.spec.ts`).
- [ ] `npx eslint e2e/support/applications.ts e2e/applications.spec.ts e2e/pipeline-stages.spec.ts e2e/pipeline-closed.spec.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`).
- [ ] Commit único `test(e2e): stage changes, application detail and closed job journeys [HU-05 TASK-15]` cuyo cuerpo
      cita `e2e/applications.spec.ts:126` y `:144`.

## Notas de implementación
- **Ningún e2e cierra ofertas con inscripciones** (DT-10 de HU-04, ventana de INV-05 hasta HU-06); la `closed` del seed
  solo se lee.
- Contratar cambia la retención del candidato: por eso cada test crea el suyo (riesgo del TD-frontend).
- Selectores por rol y nombre accesible completo («Rechazar: Inscribe Apellido…», DD-04).
- Datos inventados con `@example.com` y sin teléfono; nota no sensible («Prefiere jornada parcial.» + segunda línea).
