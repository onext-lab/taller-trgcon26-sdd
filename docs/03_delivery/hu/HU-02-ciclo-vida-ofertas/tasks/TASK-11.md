# TASK-11 — Editar y borrar según el estado en la web

## Metadata
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 2,5 h)

## Descripción
Lo que cambia al editar o borrar una oferta que ya no es borrador (RF-03):
- **Formulario de una publicada:** «(obligatorio)» y `required` en Descripción, Ubicación y Modalidad (además del
  título); `validateJobForm(values, { published: true })` da «Obligatorio en una oferta publicada.» junto al campo,
  sin `PATCH` (DD-08).
- **Errores del servidor:** `splitServerError` y `focusFirstError` salen de `JobFormScreen.tsx` a `job-form-errors.ts`
  (primero se extrae y después se amplía, para que `JobFormScreen.tsx` no pase de 300), con la rama del 409.
- **Oferta cerrada en la edición:** `ClosedJobNotice` (sin formulario) por URL directa o tras un 409 al guardar, que
  muestra el `message` y recarga (DD-06). **Decisión aceptada:** `ClosedJobNotice` va dentro de `JobFormScreen.tsx` (el
  TD no le da fichero propio).
- **Borrado:** `DeleteJobAction` gana `onConflict(message)`: un 409 cierra el diálogo y el contenedor muestra el
  mensaje y recarga (ya sin «Borrar»). `JobActions` se lo pasa.

Los casos hostiles de RF-03 en la web (409 al borrar, 500 al guardar, `toPatch` sin campos de solo lectura) los prueba la
tarea `[adversarial]` TASK-12.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/job-form-model.ts` | modificar | `validateJobForm(values, { published })` (~185 líneas) |
| `apps/web/src/features/jobs/JobForm.tsx` | modificar | Prop `published`; etiquetas «(obligatorio)» y `required` (~145) |
| `apps/web/src/features/jobs/job-form-errors.ts` | crear | `splitServerError` y `focusFirstError` extraídos, con la rama 409 (~70) |
| `apps/web/src/features/jobs/JobFormScreen.tsx` | modificar | `published` al formulario; 409 → alerta + recarga; `closed` → `ClosedJobNotice` (~230) |
| `apps/web/src/features/jobs/DeleteJobAction.tsx` | modificar | Prop `onConflict(message)` (~95) |
| `apps/web/src/features/jobs/JobActions.tsx` | modificar | Pasa `onConflict` a `DeleteJobAction` |
| `apps/web/test/features/jobs/job-form-model.published.test.ts` | crear | Reglas de una publicada (hermano: `job-form-model.test.ts` está a 258) |
| `apps/web/test/features/jobs/JobFormScreen.published.test.tsx` | crear | Edición de una publicada y de una cerrada (hermano: `JobFormScreen.test.tsx` está a 282) |

## Implementa
- RF: RF-03 (web) · RNF: RNF-05 · CA: CA-10, CA-11, CA-12 · Edge cases: EC-17, EC-19, EC-44
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Editar, § Diagrama de secuencia RF-03, § Error paths
  (EC-17, EC-19, EC-21, EC-44), DD-06, DD-08, § Estrategia de tests (fila RF-03), § Checklist paso 6 y «Umbrales»

## Dependencias
- **Depende de:** TASK-03 (409 y 400 de `PATCH`/`DELETE` según el estado), TASK-09 (`JobActions` y la alerta de acción
  del contenedor)
- **Bloquea:** TASK-12, TASK-14

## Criterios de done
- [ ] Al editar una publicada se ven «Título (obligatorio)», «Descripción (obligatorio)», «Ubicación (obligatorio)» y
      «Modalidad (obligatorio)», con `required`.
- [ ] CA-11/EC-17: Descripción vacía o solo con espacios (y Ubicación vacía, Modalidad sin valor) → «Obligatorio en una
      oferta publicada.» junto al campo, foco en él y **sin** `PATCH`. Un 400 del servidor con ese `details` se pinta
      igual.
- [ ] EC-19: cambiar solo la banda de una publicada → `PATCH { salaryMin }` → ficha «Publicada» con «Cambios
      guardados.».
- [ ] CA-12/EC-44: 409 al guardar → `ClosedJobNotice` con el `message` de la API en `role="alert"` y «Ver la oferta»
      (`/jobs/:id`); la oferta se ha vuelto a pedir.
- [ ] CA-10: `/jobs/:id/edit` de una `closed` → h1 «Editar oferta», `role="alert"` «Esta oferta está cerrada y no se
      puede editar.» y «Ver la oferta»; sin formulario.
- [ ] Un borrador se edita como en HU-01 (`job-form-model.test.ts`, `JobFormScreen.test.tsx`, `.edit` y `.adversarial`
      siguen verdes).
- [ ] `npm test -w apps/web -- job-form-model JobFormScreen DeleteJobAction JobDetailScreen` en verde, con **10**
      ficheros de test ejecutados (`job-form-model` recoge 2; `JobFormScreen` recoge 4: `.test`, `.edit`,
      `.adversarial` y `.published`; `DeleteJobAction` 1; `JobDetailScreen` 3). Si TASK-10 aún no se ha integrado (van
      en paralelo), `JobDetailScreen` recoge 2 y el total es 9.
- [ ] `npm test -w apps/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobForm.tsx apps/web/src/features/jobs/job-form-errors.ts apps/web/src/features/jobs/JobFormScreen.tsx apps/web/src/features/jobs/DeleteJobAction.tsx apps/web/src/features/jobs/JobActions.tsx apps/web/test/features/jobs/job-form-model.published.test.ts apps/web/test/features/jobs/JobFormScreen.published.test.tsx`
      sin errores.
- [ ] `JobFormScreen.tsx` ≤ 300 líneas y ninguna función > 50.
- [ ] Commit único `feat(web): edit and delete according to job status [HU-02 TASK-11]` nombrando los ficheros.

## Notas de implementación

**Edición según la oferta cargada:**

| Oferta | Qué se ve |
|---|---|
| `draft` | Formulario de HU-01, sin cambios |
| `published` | Mismo formulario con los 4 obligatorios marcados (`required`); vaciar uno (o dejarlo en espacios) → «Obligatorio en una oferta publicada.» junto al campo, foco en él, sin `PATCH` |
| `closed` (URL directa o tras un 409) | `ClosedJobNotice`: h1 «Editar oferta», `role="alert"` con el `message` del 409 si viene de guardar o, si no, «Esta oferta está cerrada y no se puede editar.», y enlace «Ver la oferta». Sin formulario |

- Contrato (manda el backend): `PATCH` → 409 «Una oferta cerrada no se puede editar.»; 400 «Obligatorio en una oferta
  publicada.» por campo vacío tras la fusión (si además falla la banda, `salaryMin` va en el mismo `details`).
  `DELETE` → 409 «Una oferta publicada no se puede borrar.» / «Una oferta cerrada no se puede borrar.».
- El mensaje «Obligatorio en una oferta publicada.» está en dos sitios (API y `job-form-model.ts`); la web no compara
  más textos de la API (tradeoff de DD-08).
- **409 al guardar** (DD-06): la alerta vive en el contenedor, por encima del recurso, y sobrevive al `retry()`; como la
  oferta ya está cerrada, se ve `ClosedJobNotice`. Lo escrito se pierde (tradeoff aceptado).
- `toPatch` sigue enviando solo lo cambiado; nunca `status` ni fechas (lo fija TASK-12, EC-23).
- **`DeleteJobAction`:** 409 → cierra el diálogo y llama a `onConflict(message)`; el contenedor (TASK-09) muestra la
  alerta y llama a `retry()`. El resto de su comportamiento (204, 404, 500) no cambia. Su prop `disabled` (TASK-09) se
  mantiene. El test del 409 es de TASK-12.

**Tests:**
- `job-form-model.published.test.ts`: reglas con `{ published: true }` (vacío, espacios, `workMode` sin valor) y sin
  ellas (borrador: como HU-01).
- `JobFormScreen.published.test.tsx`: etiquetas «(obligatorio)»; descripción en espacios → error sin `PATCH` (CA-11,
  EC-17); 400 del servidor junto al campo; solo banda (EC-19); 409 → `ClosedJobNotice` con el `message` (CA-12, EC-44);
  URL de una cerrada → `ClosedJobNotice` sin formulario (CA-10).
- `mockFetch` con la URL exacta; datos inventados.
