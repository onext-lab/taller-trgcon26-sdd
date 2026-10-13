# TASK-08 — Formulario y pipeline frente a entradas a medias, fallos y el 409 del plazo [adversarial]

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-03, RF-04)
- **Complejidad:** M (1–2 h; estimada 2 h)

## Descripción
La tarea `[adversarial]` de los dos RF Must de la web (gate 4), con el código de defensa que exigen sus casos:

- **RF-03 · entrada a medias** (EC-17, DD-02): con `type="date"`, una fecha incompleta da `value === ''`, y en la
  edición `''` significa «quitar el plazo» (EC-18): el reclutador lo perdería sin enterarse.
  - `apps/web/src/components/form-errors.ts`: `hasBadInput(form: HTMLFormElement, name: string): boolean` (genérico:
    `validity.badInput` del control con ese `name`).
  - `apps/web/src/features/jobs/job-form-model.ts`: `validateJobForm(values, { published?, deadlineBadInput? })`; con
    `deadlineBadInput`, «Introduce una fecha válida.» en `enrollmentDeadline` (dentro de `deadlineError`, que nació en
    TASK-06; la función sigue siendo pura).
  - `apps/web/src/features/jobs/JobFormScreen.tsx`, `handleSubmit`: pasa `deadlineBadInput: hasBadInput(form,
    'enrollmentDeadline')` → error junto al campo, foco en él y **sin petición**.
- **RF-04 · pipeline viejo e «Inscribir» después de medianoche** (CA-10 web, EC-27, DD-05):
  - `apps/web/src/features/applications/enroll-errors.ts`: `classifyEnrollError` → tipo `'deadline-passed'` por
    `code === 'ENROLLMENT_DEADLINE_PASSED'` (el `details`, si viniera, se ignora).
  - `apps/web/src/features/applications/use-enrollment.ts`: callback `onDeadlinePassed(message)`.
  - `apps/web/src/features/applications/PipelineScreen.tsx`, `enrollCallbacks`: `onDeadlinePassed(message)` →
    `panel.dismiss()`, `feedback.show('alert', message)` (el `message` **de la API**, con el foco) y `reload()`, como
    `onNotPublished`. Tras recargar, `canEnroll` (TASK-07) quita el botón y aparece el texto de vencido.

## Tests

| Test | Fichero | Categoría (QUALITY-GATES § 3) |
|---|---|---|
| «EC-17 entrada a medias (badInput) da «Introduce una fecha válida.» sin petición» (simula `validity.badInput` con `Object.defineProperty` sobre el `input`, DD-02); en alta y en edición de una oferta con plazo (no se envía `null`) | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` | 1 Input inválido |
| «EC-17 validateJobForm con deadlineBadInput → error; sin él y vacío → válido» | `apps/web/test/features/jobs/job-form-model.deadline.test.ts` | 1 |
| «hasBadInput: true solo para el control con badInput» | `apps/web/test/components/form-errors.test.ts` | 1 |
| «EC-19 red caída al guardar conserva la fecha escrita» | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` | 3 Fallo de dependencia |
| «EC-20 doble clic con fecha = 1 POST» | `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` | 4 Concurrencia · 7 Idempotencia |
| «classifyEnrollError: ENROLLMENT_DEADLINE_PASSED → 'deadline-passed'» | `apps/web/test/features/applications/api.test.ts` | 4 |
| «CA-10 pipeline viejo: el 409 cierra el panel, alerta con el mensaje y foco, y la recarga quita el botón» (texto literal «El plazo de inscripción de esta oferta terminó el 13/10/2026.»; tras recargar, 0 `button` «Inscribir candidato» y el `status` de vencido) | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx` | 4 Concurrencia |
| «EC-26 el 409 con la recarga en 500: alerta y error con «Reintentar»» (2 `alert` y `button` «Reintentar») | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx` | 3 Fallo de dependencia |
| «EC-15 la alerta del 409 no añade el nombre del candidato» | `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx` | 6 Seguridad |

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/web/src/components/form-errors.ts` | Modificar | `hasBadInput(form, name)` |
| `apps/web/src/features/jobs/job-form-model.ts` | Modificar | Opción `deadlineBadInput` en `validateJobForm` |
| `apps/web/src/features/jobs/JobFormScreen.tsx` | Modificar | `handleSubmit` pasa `deadlineBadInput` |
| `apps/web/src/features/applications/enroll-errors.ts` | Modificar | Tipo `'deadline-passed'` por `code` |
| `apps/web/src/features/applications/use-enrollment.ts` | Modificar | Callback `onDeadlinePassed(message)` |
| `apps/web/src/features/applications/PipelineScreen.tsx` | Modificar | `enrollCallbacks.onDeadlinePassed` |
| `apps/web/test/components/form-errors.test.ts` | Modificar | `hasBadInput` |
| `apps/web/test/features/jobs/job-form-model.deadline.test.ts` | Modificar | EC-17 en el modelo |
| `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` | Modificar | EC-17, EC-19, EC-20 |
| `apps/web/test/features/applications/api.test.ts` | Modificar | `classifyEnrollError` |
| `apps/web/test/features/applications/PipelineScreen.deadline.test.tsx` | Modificar | CA-10, EC-26, EC-15 (web) |

## Implementa
- RF: RF-03, RF-04 (cobertura adversarial y el 409 de la página vieja) · CA: CA-10 (web) · RNF-02 (`role="alert"`) ·
  Edge cases: EC-15 (web), EC-17, EC-19, EC-20, EC-26, EC-27
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (filas del 409), § Diagrama de secuencia (flujo 4),
  § Error paths, DD-02, DD-05, § Estrategia de tests (`[adversarial]` por RF Must: RF-03 → EC-17 y EC-20; RF-04 → CA-10
  y EC-26), § Checklist de implementación (puntos 2.1 y 4.2, parte del 409)

## Dependencias
- **Depende de:** TASK-06, TASK-07 (y el 409 de TASK-03, contrato S5)
- **Bloquea:** nada

## Criterios de done
- [ ] `npm test -w apps/web -- deadline form-errors features/applications/api` en verde.
- [ ] `npm test -w apps/web` completo en verde.
- [ ] Cada test nombra su EC/CA en el título.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components/form-errors.ts apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobFormScreen.tsx apps/web/src/features/applications apps/web/test/components/form-errors.test.ts apps/web/test/features/jobs apps/web/test/features/applications`
      sin errores.
- [ ] Ningún fichero pasa de 300 líneas; si `JobFormScreen.deadline.test.tsx` o `PipelineScreen.deadline.test.tsx`
      lo superan, **para y avisa** antes de crear un fichero hermano (el TD no lo prevé).
- [ ] Commit único `feat(web): guard partial date input and handle late-enrollment 409 [HU-07 TASK-08]`.

## Notas de implementación
- En jsdom `badInput` siempre es `false`: el único modo de probar DD-02 es `Object.defineProperty(input, 'validity',
  { value: { …, badInput: true } })`. El caso real en Chromium no se prueba en el e2e (riesgo aceptado en el TD).
- DD-05 se aparta conscientemente de la convención de HU-04 (textos del 409 en la web): aquí se muestra el `message` de
  la API porque lleva la fecha que usó el servidor. El test fija el texto literal.
- Un 500 al inscribir sigue como hoy: alerta del panel sin recarga (EC-12, parte web, sin cambios).
