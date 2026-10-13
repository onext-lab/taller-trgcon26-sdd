# TASK-07 — Pipeline sin «Inscribir candidato» cuando el plazo venció

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-04)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
En una oferta `published` con el plazo vencido, el pipeline no ofrece «Inscribir candidato» y explica por qué con el
texto de DT-01; «Avanzar», «Rechazar» y el historial siguen igual (RN-10). El «vencido» lo calcula la API
(`enrollmentDeadlinePassed`, reloj del servidor): la web solo lo pinta (DD-04). El 409 de una página vieja lo trata
TASK-08.

1. **Tipos y cliente** (`apps/web/src/features/applications/`):
   - `types.ts`: `PipelineJob` = `{ id: number; status: PipelineJobStatus; enrollmentDeadline: string | null;
     enrollmentDeadlinePassed: boolean }` (`Pipeline.job` lo usa).
   - `api.ts`, `isPipeline`: valida los dos campos (`enrollmentDeadline` `null` o `isCalendarDate` de
     `apps/web/src/components/format.ts`; `enrollmentDeadlinePassed` booleano) y la **coherencia** (vencido ⇒ fecha no
     nula). Una respuesta incoherente → estado de error con «Reintentar».
   - `labels.ts`: `canEnroll(job) = job.status === 'published' && !job.enrollmentDeadlinePassed` y
     `deadlinePassedText(date)` → «El plazo de inscripción terminó el dd/mm/aaaa: no se pueden inscribir más
     candidatos.» (con `formatCalendarDate`).
2. **Pantalla** (`apps/web/src/features/applications/PipelineScreen.tsx`):
   - `DeadlinePassedNotice` (**nuevo**, presentacional, en este fichero): `{ deadline: string }` →
     `<p role="status">{deadlinePassedText(deadline)}</p>`.
   - `PipelineLoader`: `enrollable = success && canEnroll(job)` → `useEnrollPanel(enrollable, …)` (si una recarga trae
     el plazo vencido, el panel se descarta solo, mecanismo actual).
   - `PipelineContent`: botón y panel con `canEnroll`; el aviso solo si `status === 'published' &&
     enrollmentDeadlinePassed` (en `closed` manda lo de hoy, EC-28; en `draft`, el texto de borrador de hoy). `actions`
     del tablero sigue dependiendo **solo** de `status === 'published'` (RN-10).
   - `apps/web/src/features/applications/use-enroll-panel.ts`: solo renombra el parámetro `published` → `enrollable`.
3. **Fixtures** (`apps/web/test/features/applications/fixtures.ts`): los 4 pipelines con `enrollmentDeadline: null,
   enrollmentDeadlinePassed: false`; nuevos `EXPIRED_PIPELINE` (con inscripciones) y `EXPIRED_EMPTY_PIPELINE` (fecha
   `2026-10-10`). En línea: `apps/web/test/App.test.tsx:125` y `:193`, `PipelineScreen.states.test.tsx:80`,
   `PipelineScreen.test.tsx:31` y `:136`, `api.test.ts:84` y `:110`.
4. **Tests**:
   - `apps/web/test/features/applications/labels.test.ts` (modificar): `deadlinePassedText('2026-10-13')` → texto de
     DT-01; `canEnroll` en los 3 estados × vencido.
   - `apps/web/test/features/applications/api.test.ts` (modificar): `isPipeline` con los dos campos; rechaza vencido
     sin fecha y fecha no válida.
   - `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx` (**crear**):
     - «CA-12 vencida con inscripciones: sin botón, texto en status y «Avanzar»/«Rechazar» presentes».
     - «CA-12 vencida sin inscripciones: texto y vacío».
     - «CA-06 con enrollmentDeadlinePassed false tras ampliar, el pipeline vuelve a ofrecer «Inscribir candidato»».
     - «EC-25 plazo hoy (passed: false) con botón; ayer (passed: true) sin él» y «EC-14 sin plazo, con botón».
     - «EC-28 una cerrada con el plazo vencido no muestra el texto del plazo».
     - «EC-30 «Reintentar»/recarga mantiene el estado sin botón».

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/web/src/features/applications/types.ts` | Modificar | `PipelineJob` con los dos campos |
| `apps/web/src/features/applications/api.ts` | Modificar | `isPipeline` con campos y coherencia |
| `apps/web/src/features/applications/labels.ts` | Modificar | `canEnroll`, `deadlinePassedText` |
| `apps/web/src/features/applications/use-enroll-panel.ts` | Modificar | Parámetro `published` → `enrollable` |
| `apps/web/src/features/applications/PipelineScreen.tsx` | Modificar | `DeadlinePassedNotice`, `enrollable`, `canEnroll` |
| `apps/web/test/features/applications/fixtures.ts` | Modificar | Campos nuevos y `EXPIRED_*` |
| `apps/web/test/App.test.tsx` | Modificar | `job` del pipeline (líneas 125 y 193) |
| `apps/web/test/features/applications/PipelineScreen.states.test.tsx` | Modificar | Línea 80 |
| `apps/web/test/features/applications/PipelineScreen.test.tsx` | Modificar | Líneas 31 y 136 |
| `apps/web/test/features/applications/api.test.ts` | Modificar | Líneas 84 y 110; `isPipeline` nuevo |
| `apps/web/test/features/applications/labels.test.ts` | Modificar | `canEnroll`, `deadlinePassedText` |
| `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx` | Crear | CA-06, CA-12, EC-14, EC-25, EC-28, EC-30 |

## Implementa
- RF: RF-04 (estado vencido; sin el 409) · CA: CA-06 (web), CA-12 · RNF-02 (`role="status"`) · Edge cases: EC-14
  (web), EC-25, EC-28, EC-30
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (Pipeline), § Dependencias (S4), DD-04, § Checklist
  de implementación (punto 4.1 y la parte de pantalla de 4.2)

## Dependencias
- **Depende de:** TASK-04 (`Pipeline.job` con `enrollmentDeadline` y `enrollmentDeadlinePassed`)
- **Bloquea:** TASK-08, TASK-09

## Criterios de done
- [ ] `npm test -w apps/web -- features/applications App` en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/applications apps/web/test/features/applications apps/web/test/App.test.tsx`
      sin errores.
- [ ] Ningún fichero pasa de 300 líneas; `PipelineContent` sin pasar de 10 ramas ni de 50 líneas.
- [ ] Commit único `feat(web): hide enroll action when the enrollment deadline has passed [HU-07 TASK-07]`.

## Notas de implementación
- La web no compara fechas: nada de `new Date()` ni `Intl` para decidir el vencimiento (DD-04).
- El texto se pinta como texto JSX, nunca con `dangerouslySetInnerHTML`.
- `EnrollPanel.tsx`, `PipelineBoard.tsx` y `StageDialogs.tsx` no cambian.
