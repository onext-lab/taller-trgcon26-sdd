# TASK-06 — Fecha límite en el formulario de oferta y en la ficha

## Metadata
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** frontend
- **Capa:** web
- **Estado:** Completada
- **Prioridad:** Must (RF-03) · Could (RF-06)
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
El reclutador pone, cambia o quita la fecha límite desde el formulario de alta y edición, ve el error de la API junto
al campo, la lee en la ficha como `dd/mm/aaaa` y, si publica un borrador con el plazo vencido, lee el texto de DT-01.
**La web nunca decide qué día es hoy** (DD-03): solo comprueba que el valor tenga forma de día; «no anterior a hoy» lo
decide la API. Contrato S1-S3 del TD-frontend, que coincide con el del TD-backend (`enrollmentDeadline`).

1. **Tipos y cliente** (`apps/web/src/features/jobs/`):
   - `types.ts`: `Job.enrollmentDeadline: string | null`; `JobInput.enrollmentDeadline?: string | null` (`JobPatch` lo
     hereda).
   - `apps/web/src/components/format.ts`: `isCalendarDate(text)` (formato `AAAA-MM-DD` y día que existe; reutiliza
     `CALENDAR_DATE_PATTERN`).
   - `api.ts`: `JOB_CHECKS.enrollmentDeadline` = `value === null || (typeof value === 'string' && isCalendarDate(value))`.
   - `labels.ts`: `jobFieldLabel('enrollmentDeadline')` → «Fecha límite de inscripción».
2. **Modelo** (`apps/web/src/features/jobs/job-form-model.ts`): `enrollmentDeadline` **al final** de `FIELD_ORDER` (así
   `splitValidationDetails` reparte el 400 de la API junto al campo sin código nuevo); `EMPTY_FORM` con `''`;
   `validateJobForm`: si no es `''` y no cumple `isCalendarDate` → «Introduce una fecha válida.» (extrae
   `deadlineError(values)` para no pasar de 10 ramas; TASK-08 le añade la opción `deadlineBadInput`);
   `toCreateInput`: vacío **no viaja** (CA-01); `jobToForm`: `null` → `''` (EC-21); `toPatch`: solo si difiere de
   `original.enrollmentDeadline`; vaciar una que tenía plazo → `null` (EC-18); sin cambios → ausente (CA-05, EC-23).
3. **Formulario** (`apps/web/src/features/jobs/JobForm.tsx`): `DeadlineField` presentacional tras «Salario máximo
   (€/año)»: `<FormField id="enrollmentDeadline" label="Fecha límite de inscripción" error={errors.enrollmentDeadline}>`
   con `<input type="date" name="enrollmentDeadline" value=… onChange=…>`. Sin `required`, sin `min` ni `max` (DD-03),
   sin texto de ayuda (DD-08). El formulario sigue `noValidate`. Con error: `aria-invalid="true"` y
   `aria-describedby="enrollmentDeadline-error"` (lo pone `FormField` como en los demás campos).
4. **Ficha** (`apps/web/src/features/jobs/JobDetails.tsx`): en el `dl`, tras «Banda salarial», `dt` «Fecha límite de
   inscripción» y `dd` `<time dateTime="AAAA-MM-DD">{formatCalendarDate(date)}</time>`, **solo si** no es `null`; sin
   aviso de vencida (RF-06, DD-07).
5. **Publicar con el plazo vencido** (`apps/web/src/features/jobs/use-job-actions.ts`, `classify`, DD-06): un 400 cuyo
   `details` tiene `enrollmentDeadline` compone «Para publicar falta: …» (si hay obligatorios) y el `message` de ese
   elemento, separados por un espacio. Solo el plazo → «La fecha límite de inscripción ya ha pasado.». Un `details` con
   otros campos sigue cayendo en `error.message`, como hoy.
6. **Fixtures** (DD-09): `apps/web/test/features/jobs/fixtures.ts` (**nuevo**) con `makeJob(overrides)`, usado por los
   tests nuevos; `enrollmentDeadline: null` en los `Job` en línea de `apps/web/test/App.test.tsx` y de los 14 ficheros
   de `apps/web/test/features/jobs/` que definen `closedAt` (`grep -l closedAt`). `JobDetailScreen.actions.test.tsx`
   está en 300 líneas: usa `makeJob` en vez de añadir una línea.
7. **Tests** (Vitest + Testing Library, `mockFetch`, consultas por rol y `label`, reloj real):
   - `apps/web/test/components/format.test.ts` (modificar): `isCalendarDate` sí `2026-10-13`, `2028-02-29`; no
     `2026-02-31`, `2026-13-01`, `13/10/2026`, `2026-10-13T00:00:00Z`, `''`.
   - `apps/web/test/features/jobs/api.deadline.test.ts` (**crear**): `isJob` con fecha, `null`, ausente (no válido) y
     `2026-02-31` (no válido).
   - `apps/web/test/features/jobs/job-form-model.deadline.test.ts` (**crear**): validación (vacío válido, formato no
     válido → «Introduce una fecha válida.»), `toCreateInput` (omite vacío), `jobToForm` (`null` → `''`), `toPatch`
     (cambia → la fecha; vacía → `null`; igual → ausente).
   - `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` (**crear**):
     - «CA-01 el campo tiene su label; con fecha viaja en el POST y vacío no viaja».
     - «CA-02 un 400 de la API pone «La fecha límite no puede ser anterior a hoy.» junto al campo, con foco, y conserva
       lo escrito».
     - «CA-03 en una publicada, cambiar la fecha envía solo enrollmentDeadline y vaciarla envía null» (EC-18).
     - «CA-04 un 400 de la API en la edición queda junto al campo y no navega» (EC-17, parte web).
     - «CA-05 editar la descripción de una oferta vencida no reenvía la fecha».
     - «EC-21 una oferta sin plazo abre el campo vacío» y «EC-23 guardar sin cambios no envía PATCH».
   - `apps/web/test/features/jobs/JobDetailScreen.deadline.test.tsx` (**crear**):
     - «RF-06 la ficha muestra «Fecha límite de inscripción» 13/10/2026 sin aviso; sin fecha, sin fila» (CA-08 web: el
       borrador duplicado llega con `null` y no pinta la fila).
     - «CA-07 publicar con el plazo vencido muestra «La fecha límite de inscripción ya ha pasado.»; con obligatorios,
       las dos frases»; foco de vuelta a «Publicar».

## Archivos afectados

| Archivo | Acción | Descripción |
|---|---|---|
| `apps/web/src/components/format.ts` | Modificar | `isCalendarDate` |
| `apps/web/src/features/jobs/types.ts` | Modificar | `enrollmentDeadline` en `Job` y `JobInput` |
| `apps/web/src/features/jobs/api.ts` | Modificar | `JOB_CHECKS.enrollmentDeadline` |
| `apps/web/src/features/jobs/labels.ts` | Modificar | Etiqueta del campo |
| `apps/web/src/features/jobs/job-form-model.ts` | Modificar | `FIELD_ORDER`, `EMPTY_FORM`, `validateJobForm` (`deadlineError`), `toCreateInput`, `jobToForm`, `toPatch` |
| `apps/web/src/features/jobs/JobForm.tsx` | Modificar | `DeadlineField` |
| `apps/web/src/features/jobs/JobDetails.tsx` | Modificar | Fila «Fecha límite de inscripción» |
| `apps/web/src/features/jobs/use-job-actions.ts` | Modificar | `classify` del 400 de publicar (DD-06) |
| `apps/web/test/features/jobs/fixtures.ts` | Crear | `makeJob(overrides)` |
| `apps/web/test/App.test.tsx` y los 14 de `apps/web/test/features/jobs/` con `closedAt` | Modificar | `enrollmentDeadline: null` en los `Job` en línea |
| `apps/web/test/components/format.test.ts` | Modificar | `isCalendarDate` |
| `apps/web/test/features/jobs/api.deadline.test.ts` | Crear | `isJob` |
| `apps/web/test/features/jobs/job-form-model.deadline.test.ts` | Crear | Modelo puro |
| `apps/web/test/features/jobs/JobFormScreen.deadline.test.tsx` | Crear | CA-01 a CA-05, EC-18, EC-21, EC-23 |
| `apps/web/test/features/jobs/JobDetailScreen.deadline.test.tsx` | Crear | RF-06, CA-07, CA-08 (web) |

## Implementa
- RF: RF-03 · RF-06 · RF-01 (parte visible: CA-07) · CA: CA-01 a CA-05 (web), CA-07 (web), CA-08 (web) · RNF-02
  (campo con `<label>`) · Edge cases: EC-17 (400 de la API), EC-18, EC-21, EC-23
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (formulario y ficha), § Dependencias (S1-S3), DD-01,
  DD-03, DD-06, DD-07, DD-08, DD-09, § Checklist de implementación (puntos 1, 2 sin `hasBadInput`, y 3)

## Dependencias
- **Depende de:** TASK-02 (contrato del campo y 400 de alta, edición y publicar)
- **Bloquea:** TASK-08, TASK-09

## Criterios de done
- [ ] `npm test -w apps/web -- deadline format` en verde (incluye los 4 ficheros `*.deadline.test.*` de `jobs` y
      `format.test.ts`).
- [ ] `npm test -w apps/web` completo en verde (cascada de *fixtures*).
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/components/format.ts apps/web/src/features/jobs apps/web/test/features/jobs apps/web/test/components/format.test.ts apps/web/test/App.test.tsx`
      sin errores.
- [ ] Ningún fichero pasa de 300 líneas (ojo con `JobDetailScreen.actions.test.tsx`) ni ninguna función de 50;
      `validateJobForm` sin pasar de 10 ramas.
- [ ] Commit único `feat(web): enrollment deadline field in the job form and detail [HU-07 TASK-06]`.

## Notas de implementación
- jsdom sanea `type="date"`: un valor no válido se queda en `''`. Por eso el formato no válido se prueba en el modelo
  puro y el 400 se simula con `mockFetch` (DD-01).
- Los dos textos de DT-01 que repite la web («Introduce una fecha válida.» y, en publicar, el `message` de la API) se
  copian literales.
- La entrada a medias del control (`validity.badInput`), el doble clic y la red caída los cubre TASK-08.
- Sin `localStorage`, sin la fecha en la URL ni en `history.state`.
