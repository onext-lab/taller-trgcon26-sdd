# Changelog — HU-05 Pipeline con cambio de etapa e historial

> Lo escribe `/reviewer` al aprobar la HU. Una entrada por task entregada, en lenguaje funcional (qué puede hacer ahora
> el reclutador), no técnico.

**Veredicto:** `Aprobado con observaciones` (ronda 1, `review/REVIEW.md`).
**Endpoints nuevos:** `POST /api/applications/:id/advance`, `POST /api/applications/:id/reject` y
`GET /api/applications/:id`. El puerto `JobStatusPort` gana `getJobSummary` (título y estado de la oferta).
**Pantallas:** acciones «Avanzar» (con confirmación al contratar) y «Rechazar» (motivo y nota) en las tarjetas del
pipeline; detalle de la inscripción (`/applications/:id`) con su historial; el nombre de cada tarjeta y el 409 de
duplicado enlazan al detalle; una oferta cerrada ofrece «Ver pipeline» en solo lectura.
**Migraciones:** ninguna. **Seed:** sin cambios.

## Entradas

### 2026-10-07 — TASK-01 a TASK-05: avanzar, rechazar y detalle en la API
- **Tipo:** feature y refactor
- **Qué se entregó:** el reclutador avanza una inscripción a la etapa siguiente, la contrata o la rechaza con motivo y
  nota opcional; si otra pestaña la movió antes, recibe «La inscripción ha cambiado de etapa» y nada cambia, y repetir
  una acción ya aplicada no escribe nada. Al contratar o rechazar se recalcula la retención del candidato en la misma
  operación. El detalle de una inscripción devuelve la etapa, el candidato, la oferta y su historial, sin email ni
  teléfono.
- **Archivos afectados:** `apps/api/src/modules/applications/{transitions,repository,schemas,service,routes,ports}.ts`,
  `apps/api/src/modules/jobs/{job-status,repository}.ts`, `apps/api/src/errors.ts` y sus tests
- **Commit:** `89e4364`, `332e012`, `8155a75`, `b111063`, `715d064`
- **Desviaciones del PRD:** ninguna (PRD v1.2; DT-09: la API no comprueba el estado de la oferta hasta HU-06)

### 2026-10-07 — TASK-06 a TASK-08: adversariales de la API
- **Tipo:** test
- **Qué se entregó:** entradas hostiles, carreras entre dos pestañas, fallos de escritura que no dejan nada a medias, y
  la nota y los datos personales fuera de logs y errores.
- **Archivos afectados:** `apps/api/test/applications/{stage-change-adversarial,stage-change-failures-adversarial,stage-change-privacy,detail-adversarial}.test.ts`
- **Commit:** `08cd597`, `9fea405`, `9f1d902` · después: `a420c0e` (todos los saltos de etapa, refuerzo de la mutación
  M3), `454f2a2` (nota vaciada en el detalle)
- **Desviaciones del PRD:** ninguna

### 2026-10-07 — TASK-09 a TASK-13: etapas en la web
- **Tipo:** feature
- **Qué se entregó:** desde cada tarjeta del pipeline, «Avanzar» mueve la inscripción y «Avanzar a Contratado» pide
  confirmación; «Rechazar» abre un formulario con motivo y nota (hasta 500 caracteres, con aviso de que no escriba
  datos sensibles). Los conflictos recargan el pipeline con un mensaje claro. El detalle de la inscripción muestra su
  historial con fechas, motivos y notas, y una oferta cerrada enseña su pipeline sin acciones.
- **Archivos afectados:** `apps/web/src/features/applications/*`, `apps/web/src/components/ConfirmDialog.tsx`,
  `apps/web/src/features/jobs/JobActions.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css` y sus tests
- **Commit:** `59bb095`, `9a4a939`, `b9126eb`, `0cd5d1f`, `9d2bff8`
- **Desviaciones del PRD:** ninguna

### 2026-10-07 — TASK-14 y TASK-15: adversarial de la web y recorridos e2e
- **Tipo:** test
- **Qué se entregó:** datos hostiles y fallos en las acciones y el detalle, doble clic, la nota fuera de URL, título y
  almacenamiento; recorridos e2e de avanzar, contratar, rechazar, consultar el historial y el pipeline de una oferta
  cerrada.
- **Archivos afectados:** `apps/web/test/features/applications/PipelineScreen.stage-adversarial.test.tsx`,
  `apps/web/test/features/applications/ApplicationDetailScreen.adversarial.test.tsx`, `e2e/pipeline-stages.spec.ts`,
  `e2e/pipeline-closed.spec.ts`, `e2e/support/applications.ts`
- **Commit:** `fac65af`, `cfc3c9b` · después: `454f2a2` (etiquetas)
- **Desviaciones del PRD:** ninguna
