# TASK-11 — Enlaces al detalle y «Ver pipeline» en una oferta cerrada

## Metadata
- **HU:** HU-05 · **Feature:** FEAT-03
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-07, RF-08)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
W3 del diseño: los tres accesos al detalle y a la cerrada, con los tests de HU-04 que cambian por ello.

1. **Nombre enlazado** en `apps/web/src/features/applications/PipelineBoard.tsx`: el primer `<p>` de la tarjeta pasa a
   `<p><Link to={applicationPath(item.id)}>{item.candidateName}</Link></p>` (texto JSX), en `published` y en `closed`.
   El primer `<p>` sigue siendo el nombre (los tests de HU-04 lo leen así).
2. **«Ver la inscripción»** en el 409 `DUPLICATE` (CA-36, DD-10):
   - `use-enrollment.ts`: `onDuplicate(existingId: number | undefined)`, leído del primer `details[]` con `existingId`
     (`http.ts` ya lo conserva);
   - `use-enroll-panel.ts`: `showAlert(text, existingId?)` y expone `alertLinkId`;
   - `EnrollPanel.tsx`: tras el `<p role="alert">` (mismo texto exacto «Este candidato ya está inscrito en la
     oferta.»), `<p><Link to={applicationPath(id)}>Ver la inscripción</Link></p>` si hay `alertLinkId`; sin `existingId`,
     sin enlace (EC-43).
3. **«Ver pipeline» en `closed`** (DT-08 b): en `apps/web/src/features/jobs/JobActions.tsx`, `<Link
   to={pipelinePath(job.id)}>Ver pipeline</Link>` como **primer** control, antes de «Duplicar».
4. **Tests de HU-04 que cambian** (listados por el aprobador, `fichero:línea`):
   - `apps/web/test/features/applications/PipelineScreen.test.tsx:59` (título: deja de decir «sin link»), `:63` y
     `:64` (la tarjeta tiene enlace; se aserta por sus `<p>`, no por `card.textContent`), `:66-68` (la lista de `link`
     incluye «Volver a la oferta» y los nombres) y `:147` (EC-30, bloque `:133-147`: de `card.textContent` a los `<p>`
     de la tarjeta). Así quedan estables cuando TASK-12 añada botones a las tarjetas.
   - `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx:82` (el test pasa a «Ver pipeline ausente solo en
     draft»; el bucle de `:88` deja de incluir `CLOSED`), `:95` (título «… y solo «Duplicar»» → «… «Ver pipeline» y
     «Duplicar»»), `:105` y `:141` → `['Ver pipeline', 'Duplicar']`.
   - `e2e/jobs-lifecycle.spec.ts:160` y `:246` → `['Ver pipeline', 'Duplicar']`. **Ajuste respecto al TD** (que los
     ponía en W7): esta tarea cambia la ficha de una cerrada y el paso de integración ejecuta ese spec
     (`docs/IMPLEMENTATION-RULE.md` R2.4); si esperaran a TASK-15, quedaría en rojo entre medias.
   - **No se tocan:** `apps/web/test/features/jobs/JobDetailScreen.actions.test.tsx` (300 líneas) ni
     `apps/web/test/features/applications/PipelineScreen.enroll.test.tsx:126` (su 409 no trae `existingId`: sigue sin
     enlace y pasa a cubrir también EC-43).
5. **Tests nuevos:** `PipelineScreen.links.test.tsx` y el hermano `JobDetailScreen.closed.test.tsx`.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/applications/PipelineBoard.tsx` | modificar | Nombre como `<Link>` al detalle |
| `apps/web/src/features/applications/use-enrollment.ts` | modificar | `onDuplicate(existingId)` |
| `apps/web/src/features/applications/use-enroll-panel.ts` | modificar | `showAlert(text, existingId?)`, `alertLinkId` |
| `apps/web/src/features/applications/EnrollPanel.tsx` | modificar | «Ver la inscripción» tras la alerta |
| `apps/web/src/features/jobs/JobActions.tsx` | modificar | «Ver pipeline» primero en `closed` |
| `apps/web/test/features/applications/PipelineScreen.links.test.tsx` | crear | Enlaces de las tarjetas, «Ver la inscripción», `closed` en solo lectura |
| `apps/web/test/features/jobs/JobDetailScreen.closed.test.tsx` | crear | «Ver pipeline» en `closed` (hermano de `JobDetailScreen.actions.test.tsx`) |
| `apps/web/test/features/applications/PipelineScreen.test.tsx` | modificar | Líneas 59, 63, 64, 66-68 y 133-147 |
| `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx` | modificar | Líneas 82-93, 95, 105 y 141 |
| `e2e/jobs-lifecycle.spec.ts` | modificar | Líneas 160 y 246 |

## Implementa
- RF: RF-07 (enlaces), RF-08 · CA: CA-22 (enlaces), CA-23, CA-36 · EC: EC-43 (sin `existingId`), EC-47, EC-49 · DD-10
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pipeline (tarjeta), § Panel «Inscribir candidato», § Ficha de la oferta,
  DD-10, § Estrategia de tests (RF-07, RF-08), § Checklist W3

## Dependencias
- **Depende de:** TASK-09 (`applicationPath`)
- **Bloquea:** TASK-12, TASK-15

## Criterios de done
- [ ] `npm test -w @ats/web -- features/applications/PipelineScreen.links features/applications/PipelineScreen.test features/jobs/JobDetailScreen`
      en verde con **6** ficheros (`PipelineScreen.links`, `PipelineScreen.test`, `JobDetailScreen.test`,
      `JobDetailScreen.actions`, `JobDetailScreen.states`, `JobDetailScreen.closed`), entre ellos:
  - «CA-22 el nombre de cada tarjeta es un link a /applications/{id} en published y closed».
  - «CA-36 409 DUPLICATE con existingId → Ver la inscripción a /applications/91; el texto de la alerta no cambia».
  - «EC-43 409 DUPLICATE sin existingId → sin enlace».
  - «CA-23/EC-49 closed con una tarjeta en interview: sin Avanzar, Rechazar ni Inscribir candidato, nombres enlazados».
  - «EC-47 closed vacía: mensaje de vacío y ningún botón».
  - `JobDetailScreen.closed.test.tsx`: «CA-23 closed → controles ['Ver pipeline', 'Duplicar'] con href /jobs/7/pipeline».
- [ ] `npm test -w @ats/web` en verde (sin regresiones).
- [ ] `npx playwright test e2e/jobs-lifecycle.spec.ts` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications/PipelineBoard.tsx apps/web/src/features/applications/use-enrollment.ts apps/web/src/features/applications/use-enroll-panel.ts apps/web/src/features/applications/EnrollPanel.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/test/features/applications/PipelineScreen.links.test.tsx apps/web/test/features/jobs/JobDetailScreen.closed.test.tsx apps/web/test/features/applications/PipelineScreen.test.tsx apps/web/test/features/jobs/JobDetailScreen.states.test.tsx e2e/jobs-lifecycle.spec.ts`
      sin errores.
- [ ] Ningún fichero tocado pasa de 300 líneas tras Prettier (`wc -l`); `JobDetailScreen.actions.test.tsx` sin tocar.
- [ ] Commit único `feat(web): link pipeline cards and duplicate alert to the application; view pipeline of a closed job [HU-05 TASK-11]`
      cuyo cuerpo cita las líneas cambiadas de `PipelineScreen.test.tsx`, `JobDetailScreen.states.test.tsx` y
      `e2e/jobs-lifecycle.spec.ts`.

## Notas de implementación
- `features/jobs/JobActions.tsx` puede importar `pipelinePath` de `features/applications/paths.ts` (dirección
  `jobs → applications`, ya usada en `published`).
- En este punto las tarjetas aún no tienen acciones: el test de `closed` sin «Avanzar»/«Rechazar» pasa ya y protege
  EC-49 cuando TASK-12 las añada (las acciones dependen del estado de la oferta, DT-09).
- `<p>` del enlace fuera del `<p role="alert">` (DD-10): el lector anuncia el texto sin el enlace y los asertos de HU-04
  sobre el texto exacto siguen valiendo.
