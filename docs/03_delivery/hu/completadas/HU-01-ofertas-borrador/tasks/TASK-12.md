# TASK-12 — Formulario de alta de ofertas

## Metadata
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** frontend
- **Estado:** Completada
- **Prioridad:** Must
- **Complejidad:** L (2–4 h; estimada 3,5 h)

## Descripción
La pantalla «Nueva oferta» (`/jobs/new`), de extremo a extremo en la web:
- `job-form-model.ts`: estado del formulario en cadenas, validación en cliente con las reglas de RF-02 y conversión al
  cuerpo del `POST` (`toCreateInput`). Funciones puras, probadas sin DOM.
- `JobForm` (presentacional, con `FormField`) y `JobFormScreen` en modo alta: valida al enviar, llama a `createJob`,
  pinta los errores 400 de la API junto a cada campo y navega a la ficha con «Oferta creada.».
- Ruta `/jobs/new` en `App.tsx`.

`JobFormScreen` nace aquí preparado para dos modos; la edición la completa TASK-13. El doble clic (EC-06) se
**implementa** aquí y su test adversarial está en TASK-14.

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/jobs/job-form-model.ts` | crear | `JobFormValues`, `validateJobForm`, `toCreateInput` |
| `apps/web/src/features/jobs/JobForm.tsx` | crear | Formulario presentacional (`<form noValidate>`) |
| `apps/web/src/features/jobs/JobFormScreen.tsx` | crear | Contenedor del alta (y esqueleto del modo edición) |
| `apps/web/src/App.tsx` | modificar | Ruta `/jobs/new` → `JobFormScreen` en modo alta |
| `apps/web/test/features/jobs/job-form-model.test.ts` | crear | Reglas y conversión |
| `apps/web/test/features/jobs/JobFormScreen.test.tsx` | crear | Alta |

## Implementa
- RF: RF-01, RF-02 (web) · RNF: RNF-05 · CA: CA-01, CA-02, CA-03, CA-04, CA-05, CA-06, CA-07 (web) · Edge cases:
  EC-02 (`toCreateInput` sin campos de solo lectura), EC-03, EC-04, EC-05, EC-10, EC-11, EC-12, EC-13, EC-17 (cliente)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados (fila «Nueva oferta» y tabla «Formulario»),
  § Diagrama de secuencia RF-01/RF-02, § Error paths (EC-02 a EC-17), DD-04, § Estrategia de tests (filas RF-01 y
  RF-02), § Checklist paso 6

## Dependencias
- **Depende de:** TASK-11 (`App.tsx`; la ficha a la que se navega). El `POST` real existe desde TASK-03.
- **Bloquea:** TASK-13

## Criterios de done
- [ ] Con solo el título «Desarrollador/a backend (Node.js)», «Guardar» envía `POST /api/jobs` y navega a
      `/jobs/{id}` con «Oferta creada.» (CA-01).
- [ ] El cuerpo enviado lleva los textos recortados y **omite** los opcionales vacíos; nunca `status`, `createdAt` ni
      `id` (CA-02, EC-02, EC-03).
- [ ] Con errores de cliente: mensaje junto a cada campo, `aria-invalid="true"`, `aria-describedby` al `<p
      id="{campo}-error">`, foco en el primer campo con error y **ninguna** petición.
- [ ] Un 400 de la API con `details` de `title` y `workMode` se pinta junto a cada campo con el `message` de la API y
      foco en el primero (CA-03, CA-05, EC-10).
- [ ] Un 500 muestra `role="alert"` con «Error interno. Inténtalo de nuevo.», se queda en el formulario con lo escrito
      y «Guardar» se reactiva (EC-05).
- [ ] `npm test -w apps/web -- job-form-model JobFormScreen App.test` en verde, con **3** ficheros de test ejecutados.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/App.tsx apps/web/src/features/jobs/job-form-model.ts apps/web/src/features/jobs/JobForm.tsx apps/web/src/features/jobs/JobFormScreen.tsx apps/web/test/features/jobs/job-form-model.test.ts apps/web/test/features/jobs/JobFormScreen.test.tsx`
      sin errores.
- [ ] Ficheros ≤ 300 líneas y funciones ≤ 50: `JobFormScreen` delega validación y conversión en `job-form-model.ts`.
- [ ] Commit único `feat(web): create job form [HU-01 TASK-12]` nombrando los ficheros.

## Notas de implementación

**Formulario** (`JobForm`, `<form noValidate>`, h1 «Nueva oferta», `document.title` «Nueva oferta · ATS»):

| Campo | Control (nombre accesible) | Regla en cliente (refleja RF-02; la API manda) | Mensaje |
|---|---|---|---|
| `title` | `<input type="text" required>` «Título (obligatorio)» | recortado, 3-120 caracteres contados con `Array.from()` | vacío: «Escribe un título.» · fuera de rango: «El título debe tener entre 3 y 120 caracteres.» |
| `description` | `<textarea>` «Descripción» · ayuda «Hasta 5 000 caracteres.» | recortada, ≤ 5 000 | «La descripción no puede pasar de 5 000 caracteres.» |
| `location` | `<input type="text">` «Ubicación» | recortada; si no queda vacía, 2-120 | «La ubicación debe tener entre 2 y 120 caracteres.» |
| `workMode` | `<select>` «Modalidad»: «Sin indicar», «Presencial», «Híbrida», «Remota» (valores literales `""`, `presencial`, `híbrida`, `remota`) | uno de los 3 o vacío | «Elige presencial, híbrida o remota.» |
| `salaryMin` / `salaryMax` | `<input type="text" inputMode="numeric">` «Salario mínimo (€/año)» / «Salario máximo (€/año)» | vacío o `/^\d+$/` y > 0; mínimo ≤ máximo si vienen los dos | «Escribe un número entero mayor que 0, sin puntos ni espacios.» · «El salario mínimo no puede ser mayor que el máximo.» (en el mínimo) |

- **Sin `maxLength` nativo**: cuenta unidades UTF-16 y cortaría títulos válidos con emoji (EC-04).
- Los valores de `<option>` salen del código fuente en **NFC** (`híbrida` con U+00ED); el test lo comprueba.
- Validación **al enviar**. Con errores: `aria-invalid`, `<p id="{campo}-error">` + `aria-describedby`, foco en el
  primero y sin petición.
- Errores 400 del servidor: cada `details[i]` cuyo `field` sea del formulario va junto a su campo con su `message`; el
  resto (campo desconocido, `body`) va al `role="alert"` del formulario, encima de los botones. Lo escrito se conserva
  siempre.
- «Guardar» (`<button type="submit">`) queda `disabled` con el texto «Guardando…» mientras hay una petición en curso,
  **más** una guarda con `useRef` para que un doble clic produzca una sola llamada (EC-06; test en TASK-14). «Cancelar»
  es un enlace a `/jobs`.
- 201 → `navigate('/jobs/{id}', { notice: 'Oferta creada.' })`. 500, red o *timeout* → `role="alert"` con
  `userMessage`, «Guardar» se reactiva; **sin reintento automático** (EC-09).

**`job-form-model.ts`** (DD-04): `JobFormValues` = las 6 claves como `string`. `validateJobForm(values)` → errores por
campo con los mensajes de la tabla. `toCreateInput(values)` → `JobInput`: título recortado; omite los opcionales
vacíos; salarios con `Number(...)`; `workMode` literal. TASK-13 añadirá `toPatch` y la conversión desde un `Job`.

**Tests** (`fetch` simulado; consultas por rol y *label*; `fireEvent`):
- `job-form-model.test.ts`: título 2/3/120/121, solo espacios y 120 caracteres con emoji (`'🎨'.repeat(120)` válido);
  descripción 5 000/5 001; ubicación 1/2/120/121 tras recortar; salarios `0`, `-1`, `40000.5`, `40.000` → error;
  mínimo > máximo → error en el mínimo; mínimo = máximo, solo uno → válidos (CA-03 a CA-07, EC-04, EC-11 a EC-13,
  EC-17); `toCreateInput` recorta, omite vacíos, no incluye `status`/`createdAt`/`id` y conserva `híbrida` en NFC.
- `JobFormScreen.test.tsx` (alta): CA-01 navega a la ficha; CA-02 cuerpo enviado («  Técnica/o de selección  »,
  `híbrida`, «Valencia», 32000-40000 → recortado y sin opcionales vacíos); error de cliente sin petición y foco en el
  primero; 400 con `details` de `title` y `workMode` junto al campo con `aria-describedby` (CA-03, CA-05, EC-10); 500
  conserva lo escrito (EC-05).
