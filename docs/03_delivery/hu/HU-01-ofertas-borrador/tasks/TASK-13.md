# TASK-13 — Edición de un borrador en la web y errores del servidor en el formulario

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** frontend
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3 h)

## Descripción
Completa `JobFormScreen` con el modo edición (`/jobs/:id/edit`): precarga la oferta, valida con las mismas reglas que
el alta, envía **solo los campos cambiados** (`toPatch`; vaciado → `null`) y vuelve a la ficha con «Cambios
guardados.». Cierra además la cobertura de los errores del servidor que el formulario comparte en los dos modos: 400
sin campo del formulario, 413 y red caída sin reintento.

Los adversariales de la edición (sin cambios no llama a la API; 404 al guardar) están en TASK-14.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/job-form-model.ts` | modificar | Valores desde un `Job` y `toPatch(original, values)` |
| `apps/web/src/features/jobs/JobFormScreen.tsx` | modificar | Modo edición: carga, guardado, navegación, 404 |
| `apps/web/src/App.tsx` | modificar | Ruta `/jobs/:id/edit` → `JobFormScreen` en modo edición |
| `apps/web/test/features/jobs/job-form-model.test.ts` | modificar | `toPatch` |
| `apps/web/test/features/jobs/JobFormScreen.test.tsx` | modificar | Edición y errores del servidor |

## Implementa
- RF: RF-03 (web), RF-01 y RF-02 (errores del servidor) · CA: CA-09, CA-10, CA-12 (web) · Edge cases: EC-01, EC-02,
  EC-09, EC-17 (413), EC-20, EC-21, EC-22, EC-25
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (fila «Editar» y tabla «Formulario»), § Diagrama de
  secuencia RF-03, § Error paths (EC-01, EC-02, EC-09, EC-17, EC-20 a EC-25), DD-04, § Estrategia de tests (fila
  RF-03), § Checklist paso 6

## Dependencias
- **Depende de:** TASK-12. El `PATCH` real existe desde TASK-05.
- **Bloquea:** TASK-14, TASK-15

## Criterios de done
- [ ] `/jobs/{id}/edit` muestra «Cargando la oferta…» y después el formulario (h1 «Editar oferta») con los valores
      actuales; con ID no válido, 404 o 400 → «Oferta no encontrada» como en la ficha.
- [ ] Cambiar descripción y ubicación envía `PATCH` **solo** con esos dos campos y navega a `/jobs/{id}` con «Cambios
      guardados.» (CA-09).
- [ ] Vaciar la descripción envía `{ "description": null }` (nunca `""`) (CA-10, EC-21).
- [ ] Título vacío → «Escribe un título.» junto al título y ningún `PATCH` (EC-20); 400 de la API con `title` o
      `workMode` → error junto al campo y nada cambia (CA-12).
- [ ] 500 al guardar → `role="alert"`, lo escrito se conserva (EC-22).
- [ ] Errores del servidor del formulario (alta): 400 con `field` que no es del formulario (`status`, `body`) →
      `role="alert"` (EC-01, EC-02); 413 → `role="alert"` con «El cuerpo de la petición es demasiado grande.» (EC-17);
      error de red → una sola llamada a `fetch`, sin reintento automático, lo escrito se conserva (EC-09).
- [ ] `npm test -w apps/web -- job-form-model JobFormScreen App.test` en verde, con **3** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/App.tsx apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobFormScreen.tsx apps/web/test/features/jobs/job-form-model.test.ts apps/web/test/features/jobs/JobFormScreen.test.tsx`
      sin errores.
- [ ] Ficheros ≤ 300 líneas y funciones ≤ 50 (si `JobFormScreen` crece, extrae la carga o el envío a funciones del
      modelo o a un hook en el mismo directorio de la feature).
- [ ] Commit único `feat(web): edit draft job form [HU-01 TASK-13]` nombrando los ficheros.

## Notas de implementación

**Edición** (`/jobs/:id/edit`, h1 «Editar oferta», `document.title` «Editar oferta · ATS»):
- ID con `parseJobId`; carga con `useResource(getJob)`: cargando `role="status"` «Cargando la oferta…»; 404/400 o ID no
  válido → «Oferta no encontrada» + «Volver a las ofertas»; red/5xx → `role="alert"` + «Reintentar».
- Mismo `JobForm` y mismas reglas que el alta (`validateJobForm`). «Cancelar» es un enlace a `/jobs/{id}`.
- Al guardar: `toPatch(original, values)`.
  - **Sin cambios** → `navigate('/jobs/{id}')` **sin petición** (nunca se envía `{}`, que daría 400; test en TASK-14).
  - Con cambios → `updateJob(id, patch)`:
    - 200 → `navigate('/jobs/{id}', { notice: 'Cambios guardados.' })`.
    - 400 → errores junto al campo (mismo mapeo de `details` que el alta); nada cambia.
    - 404 (borrada en otra pestaña) → `role="alert"` «Esta oferta ya no existe.» + enlace «Volver a las ofertas» (test
      en TASK-14).
    - 500 / red → `role="alert"` con `userMessage`; lo escrito se conserva; «Guardar» se reactiva.
- «Guardar» `disabled` con «Guardando…» y guarda con `useRef`, como en el alta.

**`toPatch(original: Job, values: JobFormValues)`** (DD-04): compara cada campo editable ya normalizado (texto
recortado, salario como número, `""` → `null`) con el de `original` y devuelve **solo** los que cambian; un opcional
vaciado va como `null` (nunca `""`); `title` nunca va como `null`. Solo emite campos editables (`title`,
`description`, `location`, `workMode`, `salaryMin`, `salaryMax`): nunca `status`, `createdAt` ni `id` (EC-25).
Tradeoff aceptado: si otra pestaña cambió un campo que esta no tocó, esta no lo «restaura» (gana la última escritura,
campo a campo, DEC-08).

**Contrato del `PATCH`**: campo ausente = sin cambios; `null` = sin valor; `PATCH {}` → 400 `field: "body"`;
respuesta 200 con la oferta completa; `status` y `createdAt` no cambian.

**Tests**:
- `job-form-model.test.ts`: `toPatch` sin cambios → `{}`; solo descripción y ubicación cambiadas → esas dos; vaciar la
  descripción → `{ description: null }`; recortes que no cambian el valor → no cuentan como cambio; nunca campos de
  solo lectura.
- `JobFormScreen.test.tsx` (edición): precarga; `PATCH` solo con cambios y navegación (CA-09); vaciado → `null`
  (CA-10); título vacío sin `PATCH` (EC-20); 400 de `title` o `workMode` junto al campo (CA-12); 500 conserva lo
  escrito (EC-22).
- `JobFormScreen.test.tsx` (errores del servidor, en el alta): 400 con `details` de `status` y de `body` → `role="alert"`
  (EC-01, EC-02); 413 → `role="alert"` con su `message` (EC-17); red caída → exactamente 1 llamada a `fetch` y lo
  escrito se conserva (EC-09).

## Nota · review ronda 1 (2026-10-06)
Los tests de edición viven en `apps/web/test/features/jobs/JobFormScreen.edit.test.tsx` (umbral de 300 líneas), no en `JobFormScreen.test.tsx`. El patrón `JobFormScreen` recoge los dos ficheros (y `JobFormScreen.adversarial.test.tsx` de TASK-14).
