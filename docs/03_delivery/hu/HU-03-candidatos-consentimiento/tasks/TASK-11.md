# TASK-11 — Formulario de alta y edición de candidatos en la web

## Metadata
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** frontend
- **Capa:** web
- **Estado:** Pendiente
- **Prioridad:** Must (RF-01, RF-02, RF-03 web; RNF-07, RNF-09)
- **Complejidad:** L (2–4 h; estimada 4 h)

## Descripción
Pantallas `/candidates/new` y `/candidates/:id/edit` con el patrón de `JobFormScreen`:
- `candidate-form-model.ts`: valores, `validateCandidateForm` (refleja RF-02; manda la API), `parseSkills`,
  `toCreateInput`, `candidateToForm` y `toPatch` (solo lo cambiado; sin cambios → no hay petición, DD-09).
- `candidate-form-errors.ts`: `splitCandidateServerError(error)` → `{ fields, form?, duplicateId? }`, sobre
  `splitValidationDetails` de `components/form-errors.ts`.
- `CandidateForm.tsx` (presentacional, `noValidate`, `FormField` con `autoComplete="off"`) y `CandidateFormScreen.tsx`
  (contenedores de alta y edición y `useCandidateSubmission`, con guarda `useRef` + `disabled`).
- En el alta, `<fieldset>` «Consentimiento para futuros procesos» con la casilla «El candidato da su consentimiento»
  **desmarcada** y, como ayuda, el texto de DT-01 y «Versión del texto: v1.». En la edición no hay consentimiento.
- `App.tsx`: rutas `/candidates/new` (**antes** que `/candidates/:id`) y `/candidates/:id/edit`, con títulos fijos
  «Nuevo candidato» y «Editar candidato».

## Archivos afectados

| Archivo | Cambio | Descripción |
|---|---|---|
| `apps/web/src/features/candidates/candidate-form-model.ts` | crear | Modelo y validación (~210) |
| `apps/web/src/features/candidates/candidate-form-errors.ts` | crear | `splitCandidateServerError` (~50) |
| `apps/web/src/features/candidates/CandidateForm.tsx` | crear | Formulario presentacional (~190) |
| `apps/web/src/features/candidates/CandidateFormScreen.tsx` | crear | Contenedores de alta y edición (~200) |
| `apps/web/src/App.tsx` | modificar | Rutas `/candidates/new` y `/candidates/:id/edit` con sus títulos |
| `apps/web/test/features/candidates/candidate-form-model.test.ts` | crear | Reglas, fronteras y cuerpos |
| `apps/web/test/features/candidates/CandidateFormScreen.test.tsx` | crear | Alta: CA-01, CA-03, CA-04, CA-06 |
| `apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx` | crear | Edición: CA-07 a CA-14, EC-21, EC-26, EC-38 |

## Implementa
- RF: RF-01, RF-02, RF-03 (web) · CA: CA-01, CA-03, CA-04, CA-06, CA-07 a CA-09, CA-11 a CA-14 · Edge cases: EC-03,
  EC-04, EC-09 a EC-13, EC-21, EC-22, EC-23, EC-26, EC-38, EC-53/EC-56 (500 en el alta)
- Diseño: `plans/TECHNICAL_DOC-frontend.md` § Pantallas y estados › Formulario, § Error paths (EC-03 a EC-26, EC-53,
  EC-56), DD-06, DD-07, DD-09, DD-10, § Estrategia de tests (RF-01 a RF-03), § Checklist W3

## Dependencias
- **Depende de:** TASK-03 (`POST` y `GET /:id`), TASK-04 (`PATCH`), TASK-09 (piezas y cliente)
- **Bloquea:** TASK-13, TASK-15

## Criterios de done
- [ ] CA-01: alta con «Lucía Ferrer Soler», `Lucia.Ferrer@Example.com ` y skills «TypeScript, sql, typescript,   » →
      cuerpo `{ fullName: 'Lucía Ferrer Soler', email: 'Lucia.Ferrer@Example.com', skills: ['TypeScript','sql','typescript'], consent: false }`
      (sin minúsculas ni deduplicar: normaliza el servidor) y navegación a la ficha con «Candidato creado.».
- [ ] CA-03: casilla desmarcada por defecto, con el texto de DT-01 y «Versión del texto: v1.» en su ayuda; marcada →
      `consent: true`.
- [ ] CA-04: error en cliente junto al campo, foco en el primero y **ninguna petición**; un 400 del servidor se pinta
      junto a su campo con el `message` de la API; lo escrito se conserva.
- [ ] CA-06 / EC-53 / EC-56: 500 → alerta del formulario con el `message` del envelope; campos intactos; sigue en el
      formulario.
- [ ] `candidate-form-model.test.ts`: nombre 1/2/100/101 y «Íñigo Núñez Peñalver 🎯» (EC-03); resumen 2 000/2 001;
      skill 40/41; 20 skills, 21 distintas y «21 → 20» tras minúsculas y deduplicar (válido); teléfonos de EC-13;
      `phone`/`summary` vacíos se omiten en el alta; `toCreateInput` nunca lleva `id`, fechas, versión ni
      `retentionEndsAt`.
- [ ] CA-07 / CA-08: edición con los valores actuales y sin consentimiento; `PATCH` solo con lo cambiado y vuelta a la
      ficha con «Cambios guardados.». CA-09: el email con otra forma se envía sin error en cliente.
- [ ] EC-21: vaciar teléfono, resumen y skills → `PATCH { phone: null, summary: null, skills: [] }`.
- [ ] EC-26: sin cambios → **ninguna petición** y vuelta a la ficha sin aviso.
- [ ] CA-11: 400 del servidor en `summary` (2 001) junto al campo. CA-12 / EC-22: 409 → «Ya existe un candidato con este
      email.» junto al email y enlace «Ver el candidato existente» a `/candidates/{existingId}`; foco en el email.
- [ ] CA-13: 404 o 400 al cargar la edición → «Candidato no encontrado». CA-14 / EC-23: 500 al guardar → alerta y lo
      escrito se conserva. EC-38: al volver a la ficha se pide de nuevo.
- [ ] Títulos: «Nuevo candidato · ATS» y «Editar candidato · ATS» (nunca el nombre).
- [ ] `npm test -w @ats/web -- candidate-form-model CandidateFormScreen` en verde, con **3** ficheros de test.
- [ ] `npm test -w @ats/web` completo en verde.
- [ ] `npm run typecheck` sin errores.
- [ ] `npx eslint apps/web/src/features/candidates/candidate-form-model.ts apps/web/src/features/candidates/candidate-form-errors.ts apps/web/src/features/candidates/CandidateForm.tsx apps/web/src/features/candidates/CandidateFormScreen.tsx apps/web/src/App.tsx apps/web/test/features/candidates/candidate-form-model.test.ts apps/web/test/features/candidates/CandidateFormScreen.test.tsx apps/web/test/features/candidates/CandidateFormScreen.edit.test.tsx`
      sin errores.
- [ ] Commit único `feat(web): candidate create and edit form [HU-03 TASK-11]` nombrando los ficheros.

## Notas de implementación

**Validación en cliente** (longitudes en puntos de código con `Array.from`, sin `maxLength` nativo):

| Campo | Regla | Mensajes |
|---|---|---|
| `fullName` | Recortado: no vacío; 2-100; sin C0/DEL | «Escribe el nombre y los apellidos.» · «El nombre y los apellidos deben tener entre 2 y 100 caracteres.» · «No puede tener caracteres de control.» |
| `email` | Recortado: no vacío; ≤ 254; `^[^\s@]+@[^\s@]+\.[^\s@]+$`; sin control | «Escribe el email.» · «El email no puede pasar de 254 caracteres.» · «Escribe un email válido, como nombre@example.com.» |
| `phone` | Vacío = sin valor; si no `^\+?[0-9 ()-]{6,20}$` y ≥ 6 dígitos | «Escribe entre 6 y 20 dígitos, espacios, guiones o paréntesis, con al menos 6 dígitos y un «+» opcional delante.» |
| `summary` | ≤ 2 000; admite `\n`, `\r`, `\t` | «El resumen no puede pasar de 2 000 caracteres.» · «No puede tener caracteres de control.» |
| `skills` | `parseSkills`: separa por comas, recorta, quita vacías; cuenta y mide tras minúsculas y deduplicar; sin control | «Indica como máximo 20 skills distintas.» · «Cada skill puede tener como máximo 40 caracteres.» · «No puede tener caracteres de control.» |

- Controles: `textbox` «Nombre y apellidos (obligatorio)», «Email (obligatorio)» (`inputMode="email"`), «Teléfono»
  (`inputMode="tel"`), «Resumen» (`textarea`, ayuda «Hasta 2 000 caracteres.»), «Skills» (ayuda «Separadas por comas.
  Hasta 20, de 40 caracteres como máximo cada una.»); `button` «Guardar» («Guardando…» y `disabled` en curso); enlace
  «Cancelar» (al listado en el alta, a la ficha en la edición).
- **Errores del servidor** (siempre conservando lo escrito): 400 → cada `details[i]` de un campo del formulario junto a
  él; el resto (`body`, clave desconocida, sin `details`) en la alerta; 409 → `message` junto al email + enlace por
  `existingId` (solo si es un ID válido), **sin pedir ni mostrar nada del existente** (DD-06); 404 en edición → alerta
  con «Volver a los candidatos»; 403, 413, 415, 500, red, *timeout* y forma inesperada → alerta con `userMessage`.
- `toPatch`: compara valores recortados con el original; `phone`/`summary` vaciados → `null`; `skills` si cambia la
  lista de tokens (`[]` si se vacía). Nunca el consentimiento.
- La ruta `/candidates/:id` (ficha) llega en TASK-12: aquí los tests comprueban la navegación por la ruta, no la ficha.
- Los casos hostiles del formulario (doble clic, control, claves, 403/413, título) van en TASK-13.
