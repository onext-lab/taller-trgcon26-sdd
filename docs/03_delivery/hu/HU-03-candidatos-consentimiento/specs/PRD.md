# HU-03 — Alta, edición y búsqueda de candidatos, con consentimiento — PRD

## Info
- **HU:** HU-03 · **Feature:** FEAT-02
- **Scope:** fullstack
- **Módulos:** `candidatos` (código `candidates`)
- **Fecha:** 2026-10-06
- **Estado:** Draft

## Contexto

### Problema
El reclutador no tiene dónde registrar a los candidatos: sin ficha no hay a quién inscribir en las ofertas (IDEA-002).
Cada ficha guarda datos personales, así que el consentimiento para futuros procesos y la fecha de fin de retención
tienen que ser correctos desde el alta, no después (RGPD §2 y §3). Además, el reclutador necesita encontrar un
candidato por nombre, email o skill y corregir su ficha (derecho de rectificación, RGPD §4).

### Situación actual
Solo existe el esqueleto del monorepo:
- **API:** la única ruta es `GET /api/health` (`apps/api/src/app.ts`). No hay tablas de dominio
  (`apps/api/src/db/schema.sql` solo crea `schema_migrations`; `apps/api/src/db/migrations/` está vacía), ni módulos
  (`apps/api/src/modules/` vacía), ni manejador de errores con el envelope de DEC-01, ni reloj inyectable (DEC-09).
  El seed (`apps/api/src/db/seed.ts`) es una función vacía. Los logs ya quitan la query de la URL
  (`apps/api/src/logger.ts`, probado en `apps/api/test/logger.test.ts`). Los tests montan `openDatabase(':memory:')`
  + `migrate` + `buildApp` + `inject` (`apps/api/test/health.test.ts`).
- **Web:** una sola pantalla (`apps/web/src/App.tsx`); sin router, sin `apps/web/src/features/candidates/` (nueva en
  esta HU) ni componentes compartidos (`apps/web/src/components/` vacía), sin cliente de API ni formato de fechas. Tests en
  `apps/web/test/` con Testing Library.
- **En paralelo:** HU-01 (rama `hu/HU-01-ofertas-borrador`) crea el módulo `jobs`, el manejador de errores con el
  envelope, el reloj inyectado (DEC-09) y la navegación de la web. Cómo se reparten esas piezas transversales entre las
  dos HU es la OQ-07.

### Resultado esperado
El módulo `candidatos` existe en API y web, con su migración y su seed. El reclutador da de alta candidatos con el
email y las skills normalizados, marca (o no) su consentimiento para futuros procesos, corrige sus fichas, los busca
por nombre, email o skill en un listado paginado que solo muestra nombre, email y skills, y consulta la ficha completa
con el consentimiento y la fecha de fin de retención. Esa fecha la calcula siempre el sistema con la fórmula única de
RN-07, cuyo dueño es `candidatos`, y el puerto de procesos del candidato responde «sin inscripciones» hasta que HU-04
lo implemente. Ningún dato personal aparece en logs ni en mensajes de error.

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-09 · P | Alta con email y skills normalizados, sin consentimiento, retención alta + 6 meses | CA-01, CA-02 |
| UC-09 · A1 | Alta con consentimiento: fecha, versión y retención consentimiento + 24 meses | CA-03 |
| UC-09 · E1 | Datos inválidos, campo desconocido o de solo lectura | CA-04, CA-32 |
| UC-09 · E2 | Email duplicado (también con doble clic) | CA-05, CA-32 |
| UC-09 · E3 | Fallo al guardar el alta | CA-06, CA-32 |
| UC-10 · P | Editar teléfono, resumen y skills sin recalcular la retención | CA-07 |
| UC-10 · A1 | Cambio de email por uno libre | CA-08 |
| UC-10 · A2 | Mismo email con otra forma, sin chocar consigo mismo | CA-09 |
| UC-10 · A3 | Guardar sin cambios | CA-10 |
| UC-10 · E1 | Datos inválidos al editar | CA-11 |
| UC-10 · E2 | Email de otro candidato | CA-12 |
| UC-10 · E3 | Candidato inexistente al editar | CA-13 |
| UC-10 · E4 | Fallo al guardar la edición | CA-14 |
| UC-11 · P | Búsqueda por `q` en nombre o email, sin mayúsculas ni tildes; solo nombre, email y skills | CA-15 |
| UC-11 · A1 | Listado sin filtros: los 20 más recientes | CA-16 |
| UC-11 · A2 | Filtro por una skill, combinado con `q` en Y | CA-17 |
| UC-11 · A3 | Sin resultados: estado vacío | CA-18 |
| UC-11 · A4 | Otra página o tamaño de página | CA-19 |
| UC-11 · E1 | Parámetros inválidos, sin repetir `q` | CA-20, CA-32 |
| UC-11 · E2 | API no disponible desde la web | CA-21 |
| UC-12 · P | Ficha completa, escapada, con consentimiento y fin de retención en solo lectura | CA-22 |
| UC-12 · E1 | Candidato inexistente: «Candidato no encontrado» | CA-23 |
| UC-12 · E2 | API no disponible al abrir la ficha | CA-24 |
| UC-13 · P | Registrar el consentimiento y recalcular la retención en la misma transacción | CA-25, CA-31 |
| UC-13 · A1 | Retirar el consentimiento, aunque la nueva fecha ya haya pasado | CA-26, CA-31 |
| UC-13 · A2 | Renovar un consentimiento vigente | CA-27 |
| UC-13 · A3 | Retirar sin consentimiento vigente: 200 sin cambios | CA-28 |
| UC-13 · E1 | Candidato inexistente al cambiar el consentimiento | CA-29 |
| UC-13 · E2 | Fallo al guardar: ni consentimiento ni retención cambian | CA-30 |

Ficheros de los UC: `docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-10-editar-ficha.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md` y
`docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md`.

Fuera de esta HU: UC-12 · A1 («Mientras dure el proceso»), que cubre HU-04 (ver «Fuera de scope»).

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | **Dar de alta un candidato.** Formulario «Nuevo candidato» y alta en la API: nombre y apellidos (un solo campo) y email obligatorios; teléfono, resumen y skills opcionales; casilla de consentimiento para futuros procesos desmarcada por defecto, con el texto y su versión al lado (RN-05, OQ-01). Se valida y normaliza con RF-02. La fecha de alta la pone el sistema en UTC (reloj inyectado, DEC-09). Si se marca la casilla, se guardan la fecha del consentimiento (la del alta) y la versión del texto, constante del código. La retención se calcula con RF-07. Candidato, consentimiento y retención se escriben en una sola transacción (INV-07). Respuesta 201 con la ficha completa y la web abre la ficha (UC-09 · P, A1). Email ya usado, sin distinguir mayúsculas → 409 `DUPLICATE` con el ID del existente en `details` y un mensaje que no repite el email; la web lo muestra junto al email (UC-09 · E2, DEC-07). Fallo de la base → 500 `INTERNAL_ERROR` en el envelope, sin datos personales y sin nada a medias; la web conserva lo escrito (UC-09 · E3). «Guardar» se desactiva mientras la petición está en curso. | Must | backend + frontend | - [ ] CA-01, CA-02, CA-03, CA-05, CA-06 |
| RF-02 | **Validar y normalizar la ficha** (alta y edición, misma regla). Se recortan los espacios de cada texto antes de validar; solo espacios equivale a vacío y un opcional vacío se guarda sin valor (S-03). Nombre y apellidos 2-100 caracteres; email con formato estándar, ≤ 254 caracteres, guardado en minúsculas (RN-03); teléfono con la regla de S-03 tal como la fija la OQ-05; resumen ≤ 2 000; skills recortadas, en minúsculas, sin vacías y deduplicadas antes de contar, en el orden de su primera aparición, de 0 a 20 y cada una ≤ 40 (RN-04). Caracteres de control según OQ-06. Esquema estricto: un campo desconocido o de solo lectura (`retentionEndsAt`, fechas, versión del consentimiento, ID) → 400 (S-03, DEC-07). El error es 400 `VALIDATION_ERROR` con los campos en `details`, nunca sus valores; la web lo muestra junto a cada campo con el `message` de la API y conserva lo escrito (diseño §4). La web valida también en el cliente con las mismas reglas, solo para la experiencia. | Must | backend + frontend | - [ ] CA-04, CA-11 |
| RF-03 | **Editar la ficha.** Desde la ficha, «Editar» abre el formulario con los valores actuales de nombre, email, teléfono, resumen y skills (el consentimiento no se edita aquí: RF-06). Al guardar se aplican los campos enviados con RF-02; un opcional vaciado queda sin valor. El email puede cambiar si nadie más lo usa; si solo cambia en mayúsculas o espacios, no choca consigo mismo (RV-15, UC-10 · A1, A2). Editar nunca recalcula la retención ni toca el consentimiento (RN-10). Gana la última escritura (RN-11, DEC-08). Respuesta 200 con la ficha, también si no cambia nada (UC-10 · A3), y la web vuelve a la ficha. Email de otro candidato → 409 `DUPLICATE` con su ID; ID inexistente → 404 `NOT_FOUND` sin datos; fallo de la base → 500 `INTERNAL_ERROR` sin datos personales y la ficha no cambia (UC-10 · E2, E3, E4). | Must | backend + frontend | - [ ] CA-07 a CA-14 |
| RF-04 | **Buscar y listar candidatos.** Listado con `q` (coincidencia parcial en nombre o email, sin distinguir mayúsculas ni tildes, normalización en el servidor) y filtro por una sola skill exacta comparada en minúsculas, combinados en Y (RN-08, DEC-10). Orden por fecha de alta, la más reciente primero, con desempate por ID descendente. Parámetros `page` (desde 1) y `pageSize` (20 por defecto, máximo 100). Respuesta `{ items, total, page, pageSize }` cuyos elementos llevan solo ID, nombre, email y skills (S-04, RGPD §6). `q` > 100 caracteres o con caracteres de control, `pageSize` > 100 o parámetros fuera de rango → 400 `VALIDATION_ERROR` sin repetir `q` (UC-11 · E1). La web muestra la lista con los controles que fije la OQ-04 y los estados *cargando*, *vacío* (con mensaje), *error* (con «Reintentar», conservando los filtros) y *con datos* (diseño §3). Cada nombre enlaza a la ficha. | Must | backend + frontend | - [ ] CA-15 a CA-21 |
| RF-05 | **Ver la ficha.** Muestra nombre y apellidos, email, teléfono, resumen y skills como texto (sin HTML interpretado); el consentimiento (vigente: fecha y versión; retirado: fecha de otorgamiento y de retirada; nunca dado: que no hay); y la fecha de fin de retención en `dd/mm/aaaa`, Europe/Madrid, en solo lectura (RN-09, DEC-09). Los opcionales sin valor se muestran como «Sin indicar». Acciones: «Editar» (RF-03) y las del consentimiento (RF-06). ID inexistente → 404 `NOT_FOUND` sin datos y la web muestra «Candidato no encontrado»; API caída → estado de error con «Reintentar» (UC-12 · P, E1, E2). | Must | backend + frontend | - [ ] CA-22, CA-23, CA-24 |
| RF-06 | **Registrar, renovar y retirar el consentimiento** desde la ficha, con la interacción que fije la OQ-02. Registrar (sin consentimiento vigente) y renovar (con uno vigente) guardan la fecha (la pone el sistema) y la versión actual del texto. Retirar guarda la fecha de retirada y conserva la de otorgamiento y la versión (S-07). Cada cambio recalcula la retención con RF-07 en la misma transacción (INV-07). Retirar sin consentimiento vigente → 200 sin cambios y sin tocar fechas (S-01). La petición no admite fechas ni versión (las pone el sistema). ID inexistente → 404 `NOT_FOUND`; fallo de la base → 500 `INTERNAL_ERROR` y ni el consentimiento ni la retención cambian (UC-13). Volver a otorgarlo tras una retirada, según OQ-03. | Must | backend + frontend | - [ ] CA-25 a CA-30 |
| RF-07 | **Fórmula de retención, puerto de procesos y recálculo** (dueño: `candidatos`, DEC-06). Una función pura calcula la fecha de fin de retención (`AAAA-MM-DD` de Europe/Madrid) con los datos del candidato y de sus procesos: con alguna inscripción no final, sin fecha; si no, la más tardía de las que apliquen: consentimiento vigente + 24 meses; cierre del último proceso + 6 meses; alta + 6 meses si nunca tuvo inscripciones (RN-07, RGPD §3). Las fechas de partida son el día natural en Europe/Madrid del instante UTC guardado; si el día no existe en el mes destino, último día del mes (DEC-09). `candidatos` define el puerto de procesos del candidato (¿tiene alguna inscripción no final?, ¿tuvo alguna vez?, instante de cierre del último proceso), con una implementación por defecto que responde «sin inscripciones», conectada en `apps/api/src/app.ts`. Exporta la operación interna de recálculo, que se ejecuta dentro de la transacción de quien la invoca (alta y consentimiento aquí; inscripciones en HU-04 y HU-05). Ningún otro módulo duplica la fórmula. | Must | backend | - [ ] CA-02, CA-31 |
| RF-08 | **Migración y seed.** Una migración nueva crea la tabla de candidatos con los campos de §Modelo de datos, el índice único del email y las restricciones de INV-02 e INV-04. `npm run db:reset` carga los candidatos inventados que fija la OQ-08, todos con emails `@example.com` y con la retención calculada por la función de RF-07 (RV-26, INV-03). | Should | backend | - [ ] tras `npm run db:reset`, `GET /api/candidates?pageSize=100` devuelve los candidatos del seed; todos cumplen RF-02 y su `retentionEndsAt` coincide con la función de RF-07 |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Lecturas de la API | Rendimiento | `GET /api/candidates` (con `q` y skill) y `GET /api/candidates/:id` < 200 ms por petición con 1 000 candidatos en la base, medido con `fastify.inject` en local |
| RNF-02 | Acciones de la API | Rendimiento | Alta, edición y cambios de consentimiento < 500 ms por petición con 1 000 candidatos en la base, con `fastify.inject` en local |
| RNF-03 | Sin datos personales en logs ni errores | Privacidad | 0 apariciones del nombre, email, teléfono, resumen ni del texto de `q` en las líneas de log capturadas y en los cuerpos de error de cada endpoint, con los valores de prueba de CA-32 (INV-06) |
| RNF-04 | Minimización del listado | Privacidad | Cada elemento de `items` tiene exactamente 4 campos (ID, nombre, email, skills): 0 campos de teléfono, resumen, consentimiento o retención |
| RNF-05 | Errores sin detalles internos | Seguridad | 0 respuestas de error fuera del envelope `{ error: { code, message, details? } }` y 0 con *stack trace*, también en JSON malformado y en métodos no definidos (p. ej., `DELETE /api/candidates/:id`) |
| RNF-06 | Texto libre sin HTML interpretado | Seguridad | 0 elementos HTML creados a partir del nombre, el resumen o las skills: `<script>` y `<b>x</b>` se ven como texto literal en el listado y en la ficha |
| RNF-07 | Accesibilidad de las pantallas | Accesibilidad | 100 % de los controles (campos, casilla de consentimiento, filtros) con `<label>` asociado y localizables por rol y nombre en Testing Library; mensajes de estado y de error con `role="status"` o `role="alert"` |

## Modelo de datos
- **Migración nueva** `apps/api/src/db/migrations/NNN-<descripción>.sql` (número según OQ-07 y nombre exacto en el
  diseño): tabla de candidatos (`Candidate`) con:
  - ID entero autoincremental (`docs/ARCHITECTURE.md`).
  - Nombre y apellidos (texto, obligatorio) · email (texto, obligatorio, recortado y en minúsculas, **índice único**:
    DEC-08, INV-01) · teléfono y resumen (texto, opcionales) · skills (hasta 20 etiquetas; columna o tabla hija, lo
    decide el diseño).
  - Fecha de alta (ISO 8601 UTC, obligatoria).
  - Consentimiento: fecha de otorgamiento (ISO 8601 UTC), versión del texto y fecha de retirada (ISO 8601 UTC), los
    tres opcionales.
  - Fecha de fin de retención (`AAAA-MM-DD` de Europe/Madrid). **Admite vacío** para «mientras dure el proceso»
    (RN-07); en esta HU nunca queda vacía, porque el puerto responde «sin inscripciones». Se crea ya así para que
    HU-04 no tenga que migrar la tabla.
  - Lo que necesite la búsqueda sin tildes (p. ej., un campo normalizado), lo decide el diseño (DEC-10).
- **Restricciones en la base** (`CHECK`), además de la validación de la API: email igual a su forma en minúsculas sin
  espacios alrededor (INV-02); la versión existe si y solo si existe la fecha de otorgamiento, y la de retirada solo con
  otorgamiento (INV-04).
- **Sin borrado:** ni ruta ni operación de borrar candidatos (RN-13, INV-05).
- **Datos personales:** todas las columnas salvo el ID y las fechas de alta son datos personales (ver §Datos
  personales); la fecha de alta y la de retención, también, en cuanto ligadas a una persona.

## Interfaces / endpoints / pantallas

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/candidates` | Nuevo | Alta, con el indicador de consentimiento. 201 con la ficha · 400 `VALIDATION_ERROR` · 409 `DUPLICATE` (`details` con el ID existente) · 500 `INTERNAL_ERROR` |
| GET | `/api/candidates` | Nuevo | Listado y búsqueda (`q`, skill, `page`, `pageSize`), forma DEC-10, solo ID, nombre, email y skills · 200 · 400 `VALIDATION_ERROR` |
| GET | `/api/candidates/:id` | Nuevo | Ficha completa con consentimiento y `retentionEndsAt` · 200 · 400 `VALIDATION_ERROR` (ID no entero) · 404 `NOT_FOUND` |
| PATCH | `/api/candidates/:id` | Nuevo | Edita nombre, email, teléfono, resumen o skills · 200 · 400 · 404 · 409 `DUPLICATE` · 500 |
| POST | `/api/candidates/:id/consent` | Nuevo | Registra o renueva el consentimiento (fecha y versión del sistema) y recalcula la retención · 200 con la ficha · 400 · 404 · 500 |
| POST | `/api/candidates/:id/consent/withdrawal` | Nuevo | Retira el consentimiento y recalcula la retención · 200 con la ficha (también sin cambios si no había uno vigente) · 400 · 404 · 500 |
| — | Puerto de procesos del candidato y operación interna de recálculo | Nuevo | Funciones exportadas del módulo (no HTTP); implementación por defecto «sin inscripciones» conectada en `apps/api/src/app.ts` (DEC-06) |
| Pantalla | Listado de candidatos | Nueva | Buscador `q`, filtro de skill, paginación (OQ-04), tabla con nombre (enlace a la ficha), email y skills, botón «Nuevo candidato»; estados cargando, vacío, error y con datos |
| Pantalla | Formulario de candidato (alta y edición) | Nueva | Campos con `<label>`; en el alta, casilla de consentimiento con el texto y la versión (OQ-01); errores junto al campo; «Guardar» y «Cancelar» |
| Pantalla | Ficha de candidato | Nueva | Datos, consentimiento y fin de retención en solo lectura; «Editar» y las acciones del consentimiento (OQ-02); «Candidato no encontrado» si no existe |

Los nombres exactos de las rutas de los cambios de consentimiento y de los campos (salvo `retentionEndsAt`, que ya cita
FEAT-02) los puede ajustar `/tech-design` sin cambiar códigos ni comportamiento. Cómo se llega a «Candidatos» desde la
navegación de la web depende de la OQ-07.

## Flujos de usuario
1. **Alta:** listado → «Nuevo candidato» → formulario (consentimiento desmarcado) → «Guardar» → ficha del candidato
   nuevo. Con errores, se quedan junto a cada campo y no se sale del formulario. Con un email ya usado, el error sale
   junto al email con un enlace a la ficha del existente (por su ID), sin repetir el email.
2. **Edición:** ficha → «Editar» → formulario con los valores actuales (sin el consentimiento) → «Guardar» → ficha
   actualizada. «Cancelar» vuelve a la ficha sin cambios.
3. **Búsqueda:** listado → escribe `q` y/o la skill → resultados de 20 en 20 → otra página → nombre → ficha.
4. **Consentimiento:** ficha → registrar, renovar o retirar (interacción de la OQ-02) → la misma ficha con el
   consentimiento y la nueva fecha de fin de retención.

## Datos personales
- **Qué:** nombre y apellidos, email, teléfono, resumen, skills, consentimiento (fecha de otorgamiento, versión del
  texto y fecha de retirada) y fecha de fin de retención (RGPD §1). No se recoge ningún otro dato (minimización): ni
  fecha de nacimiento, ni foto, ni categorías especiales.
- **Para qué:** identificar, contactar y valorar al candidato para inscribirlo en ofertas; el consentimiento y la
  retención, para acreditar la base jurídica de la conservación y saber cuándo hay que suprimir (RGPD §1).
- **Base jurídica:** medidas precontractuales (art. 6.1.b) y, si se marca, consentimiento para futuros procesos
  (art. 6.1.a); la retirada es el ejercicio del art. 7.3 y la edición, el de rectificación (art. 16) (RGPD §2 y §4).
- **Cuánto tiempo:** hasta la fecha de fin de retención de RN-07 (RGPD §3): sin inscripciones ni consentimiento,
  alta + 6 meses; con consentimiento vigente, consentimiento + 24 meses. Lo que se hace al vencer (anonimizar) es de la
  feature A (S-05).
- **Qué devuelve cada respuesta:** el listado, solo ID, nombre, email y skills (RNF-04); la ficha completa, solo en
  `GET /api/candidates/:id` y en las respuestas de alta, edición y consentimiento. El 409 devuelve solo el ID del
  existente.
- **Qué no aparece nunca:** nombre, email, teléfono, resumen ni `q` en logs (los logs no registran cuerpos y quitan la
  query, `apps/api/src/logger.ts`) ni en mensajes o `details` de error (RNF-03, INV-06).
- **Seed, fixtures y tests:** solo datos inventados con emails `@example.com` (RV-26, RGPD §6).

## Edge cases

Las 7 categorías de `QUALITY-GATES.md` §3, evaluadas por cada RF Must. RF-08 (Should) no las exige.

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | Cuerpo que no es JSON o que no es un objeto (`[]`, `"x"`) | 400 `VALIDATION_ERROR`; no se crea nada |
| EC-02 | RF-01 | 1 Input inválido | El alta trae el consentimiento como texto (`"sí"`), o su fecha, su versión, `retentionEndsAt`, la fecha de alta o el ID | 400 `VALIDATION_ERROR` con el campo en `details`; no se crea nada (RN-05, RN-06, S-03) |
| EC-03 | RF-01 | 2 Boundary | Nombre «Íñigo Núñez Peñalver 🎯» y email `  Inigo.Nunez@Example.com` | Se acepta; el nombre se devuelve igual y el email como `inigo.nunez@example.com` |
| EC-04 | RF-01 | 3 Fallo de dependencia | La escritura en SQLite falla (base ocupada) | 500 `INTERNAL_ERROR` en el envelope, sin *stack trace* ni datos personales; no queda ningún candidato; la web muestra el error sin salir del formulario y conserva lo escrito (UC-09 · E3) |
| EC-05 | RF-01 | 4 Concurrencia | Dos altas simultáneas con el mismo email | Una 201 y la otra 409 `DUPLICATE` con el ID de la primera: lo garantiza el índice único, no solo una comprobación previa (DEC-08) |
| EC-06 | RF-01 | 5 Datos corruptos | — | N/A — el módulo nace con esta HU: no hay filas anteriores a la migración |
| EC-07 | RF-01 | 6 Seguridad | Alta con un email ya usado | El 409 lleva en `details` solo el ID del existente; ni el mensaje ni `details` contienen el email ni otro dato del existente (UC-09 · E2, RGPD §6) |
| EC-08 | RF-01 | 7 Idempotencia | Doble clic en «Guardar» del alta | La web desactiva «Guardar» mientras la petición está en curso; si llegan dos peticiones a la API, la segunda da 409 con el ID del primero y solo existe un candidato (UC-09 · E2) |
| EC-09 | RF-02 | 1 Input inválido | Email `ana.gil`, `ana.gil@` o de 255 caracteres; teléfono «abc123»; una skill que no es texto (`42`) | 400 `VALIDATION_ERROR` con ese campo en `details`; no se guarda nada |
| EC-10 | RF-02 | 1 Input inválido | Nombre «   » | 400 por obligatorio vacío (S-03) |
| EC-11 | RF-02 | 2 Boundary | Nombre de 1/2/100/101; resumen de 2 000/2 001; skill de 40/41 caracteres tras recortar | Se aceptan 2, 100, 2 000 y 40; el resto, 400. La longitud cuenta caracteres, no bytes |
| EC-12 | RF-02 | 2 Boundary | 20 skills; 21 distintas; 21 con «TypeScript» y «typescript»; `TypeScript, sql, typescript,   `; ninguna | 20 → se acepta; 21 distintas → 400; 21 que tras deduplicar son 20 → se acepta; `typescript, sql` en ese orden; ninguna → lista vacía |
| EC-13 | RF-02 | 2 Boundary | Teléfono de 5/6/20/21 caracteres, con y sin «+» delante | Según la regla que fije la OQ-05 |
| EC-14 | RF-02 | 3 Fallo de dependencia | — | N/A — la validación y la normalización son puras (esquema y reglas en memoria) y no usan la base |
| EC-15 | RF-02 | 4 Concurrencia | — | N/A — la validación no tiene estado compartido; la unicidad del email la cubren EC-05 y EC-22 |
| EC-16 | RF-02 | 5 Datos corruptos | Una fila con el email en mayúsculas, o con versión de consentimiento sin fecha, insertada saltándose la API | La base la rechaza por su `CHECK` (INV-02, INV-04) |
| EC-17 | RF-02 | 6 Seguridad | Resumen de 1 MB; resumen con `<script>alert(1)</script>` | 1 MB → 400 por longitud (o 413 del límite de cuerpo de Fastify, en el envelope) sin guardar nada; `<script>` → se guarda tal cual y se muestra como texto (RNF-06). En ningún caso `details` repite el valor enviado |
| EC-18 | RF-02 | 7 Idempotencia | — | N/A — validar y normalizar dos veces la misma entrada da el mismo resultado; normalizar un valor ya normalizado no lo cambia |
| EC-19 | RF-03 | 1 Input inválido | `PATCH` con `{}`, o con `retentionEndsAt`, el consentimiento, la fecha de alta o el ID | 400 `VALIDATION_ERROR`; la ficha no cambia (UC-10 · E1) |
| EC-20 | RF-03 | 1 Input inválido | `PATCH /api/candidates/abc` | 400 `VALIDATION_ERROR` (el ID no es entero); nada cambia |
| EC-21 | RF-03 | 2 Boundary | `PATCH` que vacía el teléfono o el resumen (`""` o espacios) y deja las skills en `[]` | 200; esos campos quedan sin valor y la ficha muestra «Sin indicar»; la retención no cambia |
| EC-22 | RF-03 | 4 Concurrencia | Dos pestañas guardan la misma ficha; dos candidatos pasan a la vez al mismo email libre | Ficha → gana la última escritura (RN-11, DEC-08); email → uno 200 y el otro 409 `DUPLICATE` con el ID del primero (índice único) |
| EC-23 | RF-03 | 3 Fallo de dependencia | La escritura en SQLite falla al editar | 500 `INTERNAL_ERROR` sin datos personales; la ficha queda como estaba y el formulario conserva lo escrito (UC-10 · E4) |
| EC-24 | RF-03 | 5 Datos corruptos | Editar un candidato con el fin de retención vacío (posible desde HU-04, con una inscripción no final) | 200; el fin de retención sigue vacío: editar nunca recalcula (RN-10) |
| EC-25 | RF-03 | 6 Seguridad | Editar IDs secuenciales que no existen (enumeración) | 404 `NOT_FOUND` sin datos; el 409 de email nunca incluye el email (EC-07) |
| EC-26 | RF-03 | 7 Idempotencia | El mismo `PATCH` dos veces, o «Guardar» sin cambiar nada | 200 las dos; la ficha queda igual que tras el primero; ni la retención ni el consentimiento cambian (UC-10 · A3) |
| EC-27 | RF-04 | 1 Input inválido | `q` de 101 caracteres o con un carácter de control; `pageSize` 0 o 101; `page` 0 o `abc`; un parámetro desconocido | 400 `VALIDATION_ERROR`; el mensaje y `details` no repiten `q` (UC-11 · E1) |
| EC-28 | RF-04 | 2 Boundary | 0, 20 y 21 candidatos; página más allá de la última; `pageSize` 100; `q` de 100 caracteres; `q` o skill solo con espacios | 0 → estado «vacío»; 20 → 20, `total` 20; 21 → 20, `total` 21; página de más → `items` vacío con su `total`; 100 y `q` de 100 → se aceptan; solo espacios → como sin ese filtro (S-03) |
| EC-29 | RF-04 | 2 Boundary | `q=jose` con «José Ruiz» y «JOSÉ MARTÍN»; `q=ruiz@exa`; dos altas en el mismo instante | Aparecen los dos José; el email parcial encuentra a José Ruiz; empate de fecha → primero el ID mayor |
| EC-30 | RF-04 | 3 Fallo de dependencia | La API no responde o devuelve 500 | Estado «error» con `role="alert"` y «Reintentar»; los filtros escritos se conservan y se reenvían al reintentar (UC-11 · E2) |
| EC-31 | RF-04 | 4 Concurrencia | — | N/A — lectura sin efectos; un candidato creado a la vez aparece o no según el instante de la lectura, sin inconsistencias |
| EC-32 | RF-04 | 5 Datos corruptos | — | N/A — el módulo nace con esta HU; el seed y la API son las únicas vías de escritura y ambas normalizan (RF-02, RF-08) |
| EC-33 | RF-04 | 6 Seguridad | `q=' OR 1=1 --`, `q=%` o `q=_`; nombre `<img src=x onerror=alert(1)>`; `q` con un email | Búsqueda literal con sentencias preparadas (`%` y `_` no son comodines); el nombre se ve como texto; `q` no aparece en los logs (RNF-03); `items` sin teléfono, resumen ni retención (RNF-04) |
| EC-34 | RF-04 | 7 Idempotencia | — | N/A — `GET` sin efectos |
| EC-35 | RF-05 | 1 Input inválido | `GET /api/candidates/abc` o `/api/candidates/1.5` | 400 `VALIDATION_ERROR`; la pantalla muestra el mismo mensaje que para un candidato inexistente |
| EC-36 | RF-05 | 2 Boundary | Candidato con solo nombre y email; consentimiento otorgado el 2026-10-06T22:30:00Z | Teléfono y resumen «Sin indicar» y skills vacías sin huecos ni `null`; la fecha del consentimiento se muestra 07/10/2026 |
| EC-37 | RF-05 | 3 Fallo de dependencia | La API no responde al abrir la ficha | Estado «error» con `role="alert"` y «Reintentar», sin datos a medias (UC-12 · E2) |
| EC-38 | RF-05 | 4 Concurrencia | La ficha se edita en otra pestaña con esta abierta | Esta muestra lo que leyó; al volver de «Editar» o al reintentar, se vuelve a pedir y muestra lo último |
| EC-39 | RF-05 | 5 Datos corruptos | — | N/A en esta HU — un fin de retención vacío solo puede darse con una inscripción no final, que no existe hasta HU-04 (UC-12 · A1); el resto lo impiden los `CHECK` (EC-16) |
| EC-40 | RF-05 | 6 Seguridad | Resumen con `<script>` y `<b>`; skill `<i>x</i>` | Se muestran como texto literal (RNF-06); la API devuelve el texto tal cual, sin sanear. La ficha de cualquier ID se lee sin control por usuario: aceptado por DEC-04 (rol único, API en `127.0.0.1`) |
| EC-41 | RF-05 | 7 Idempotencia | — | N/A — `GET` sin efectos |
| EC-42 | RF-06 | 1 Input inválido | La petición de consentimiento trae una fecha, una versión o un campo desconocido; ID `abc` | 400 `VALIDATION_ERROR`; ni el consentimiento ni la retención cambian (RN-05) |
| EC-43 | RF-06 | 2 Boundary | Retirar el consentimiento de un candidato sin inscripciones dado de alta hace 8 meses | El fin de retención pasa a alta + 6 meses, una fecha ya pasada, y se guarda igual (UC-13 · A1, RGPD §3) |
| EC-44 | RF-06 | 2 Boundary | Consentimiento registrado el 2028-02-29 | Fin de retención 2030-02-28 |
| EC-45 | RF-06 | 3 Fallo de dependencia | Falla la escritura entre el consentimiento y la retención (fallo inyectado en el recálculo) | 500 `INTERNAL_ERROR`; `ROLLBACK`: ni el consentimiento ni la retención cambian (UC-13 · E2, DEC-06) |
| EC-46 | RF-06 | 4 Concurrencia | Una pestaña retira y otra renueva a la vez | Cada operación va en su transacción; queda el estado de la última, y su retención es exactamente la que da la fórmula para ese estado (INV-03) |
| EC-47 | RF-06 | 5 Datos corruptos | Fila con fecha de retirada sin fecha de otorgamiento | Imposible: la base la rechaza por su `CHECK` (INV-04, EC-16) |
| EC-48 | RF-06 | 6 Seguridad | Cambiar el consentimiento de un ID que no existe | 404 `NOT_FOUND` sin datos; ningún error incluye datos del candidato (UC-13 · E1) |
| EC-49 | RF-06 | 7 Idempotencia | Retirar dos veces; doble clic en «Registrar» o «Renovar» | Retirar otra vez → 200 sin cambios ni fechas nuevas (UC-13 · A3, S-01); registrar dos veces → la segunda es una renovación con fecha y versión nuevas, no un error (S-07); la web desactiva el control mientras la petición está en curso |
| EC-50 | RF-07 | 1 Input inválido | — | N/A — la función recibe datos internos ya validados y tipados (fechas guardadas por el sistema y datos del puerto), no entrada del usuario |
| EC-51 | RF-07 | 2 Boundary | Alta 2026-10-06T22:30:00Z; alta 2026-08-31 y 2027-08-31; alta 2026-10-25T00:30:00Z (cambio de hora); alta 2026-03-31 | Vencen 2027-04-07 (en Madrid ya es 07/10), 2027-02-28, 2028-02-29, 2027-04-25 y 2026-09-30 |
| EC-52 | RF-07 | 2 Boundary | Varias filas a la vez: consentimiento vigente del 2025-01-10 (→ 2027-01-10) y cierre del último proceso el 2026-09-15 (→ 2027-03-15) | 2027-03-15, la más tardía |
| EC-53 | RF-07 | 3 Fallo de dependencia | El puerto de procesos lanza un error durante el alta o el cambio de consentimiento | La operación falla con 500 `INTERNAL_ERROR`, `ROLLBACK` y nada cambia: ni se crea el candidato ni cambia el consentimiento |
| EC-54 | RF-07 | 4 Concurrencia | — | N/A — la función es pura y el recálculo corre dentro de la transacción de quien lo invoca; `node:sqlite` es síncrono (DEC-01) |
| EC-55 | RF-07 | 5 Datos corruptos | El puerto informa de una inscripción no final y también de un cierre anterior; consentimiento retirado | Sin fecha de fin (la inscripción no final manda); el consentimiento retirado no cuenta |
| EC-56 | RF-07 | 6 Seguridad | Un fallo del recálculo llega al cliente | El error va en el envelope sin datos personales ni *stack trace* (RNF-03, RNF-05) |
| EC-57 | RF-07 | 7 Idempotencia | Invocar el recálculo dos veces con los mismos datos | La misma fecha; la segunda invocación no cambia nada |

## Decisiones aplicables
- **DEC-01** (stack y envelope): Fastify con JSON Schema por ruta, `node:sqlite`, React + Vite; errores en
  `{ error: { code, message, details? } }` (RF-01 a RF-06, RNF-05).
- **DEC-03** (la `.db` no se versiona): la tabla nace en una migración nueva y el seed es inventado (RF-08).
- **DEC-04** (sin login, rol único): sin permisos por rol; la seguridad se centra en datos personales, inyección, HTML
  y tamaño (EC-07, EC-17, EC-33, EC-40).
- **DEC-05** (dependencias): si el diseño necesita una dependencia nueva (p. ej., para el formato de email o un
  router), la justifica en un `DEC-NN`.
- **DEC-06** (módulos): `candidatos` es dueño de su tabla, define el puerto de procesos del candidato y exporta la
  operación interna de recálculo; no importa nada de `ofertas` ni de `inscripciones` (RF-07).
- **DEC-07** (códigos HTTP): 201 alta; 200 lectura, edición, cambios de consentimiento y repeticiones idempotentes;
  400 `VALIDATION_ERROR` con `details`; 404 `NOT_FOUND`; 409 `DUPLICATE` con el ID existente en `details`.
- **DEC-08** (concurrencia): ediciones, última escritura (EC-22); unicidad del email por índice único traducido a 409
  (EC-05); retirar sin consentimiento, 200 sin cambios (EC-49).
- **DEC-09** (fechas y reloj): instantes en UTC; fin de retención como fecha de Europe/Madrid con último día del mes si
  no existe; reloj inyectado para los tests de fecha (RF-07, CA-02).
- **DEC-10** (listados): `page`, `pageSize` (20, máximo 100), `{ items, total, page, pageSize }`, búsqueda sin
  mayúsculas ni tildes en el servidor, desempate por ID y solo los campos de la lista (RF-04).

## Fuera de scope
- UC-12 · A1 («Mientras dure el proceso»), la implementación del puerto de procesos del candidato y las llamadas al
  recálculo al crear o cerrar inscripciones: HU-04 (y HU-05 al cerrar).
- Estado «anonimizado», la anonimización (a petición o al vencer la retención), la exclusión de anonimizados de las
  búsquedas (RV-14) y el bloqueo de su inscripción (RV-17): feature A (S-05).
- Borrar un candidato: no existe (RV-16).
- Exportación de la ficha por derecho de acceso (RGPD §4) e importación CSV (feature C, RV-27).
- Historial de versiones de la ficha o de quién la editó.
- Mostrar las inscripciones del candidato en su ficha: HU-04 y siguientes.

## Open Questions

| ID | Pregunta | Contexto | Recomendación | Decisión | Estado |
|----|----------|----------|---------------|----------|--------|
| OQ-01 | ¿Cuál es el texto del consentimiento para futuros procesos y con qué identificador de versión empieza? | RN-05 y S-07 fijan que la versión es una constante del código mostrada junto a la casilla, pero ni RV, ni S, ni los UC dan el texto ni el formato de la versión. Se guarda con cada consentimiento | Texto: «El candidato consiente que conservemos sus datos durante 24 meses para tenerle en cuenta en futuros procesos de selección. Puede retirar este consentimiento en cualquier momento.» Versión: `v1` | PENDIENTE | Abierta |
| OQ-02 | ¿Cómo registra, renueva y retira el reclutador el consentimiento en la ficha? | UC-13 habla de «marcar o desmarcar la casilla» en la ficha, pero una casilla ya marcada no se puede «volver a marcar» para renovar (UC-13 · A2), y retirar puede dejar una fecha de fin ya pasada (UC-13 · A1), que la feature A anonimizará | En la ficha, una sección «Consentimiento para futuros procesos» con el texto y su versión y una casilla: marcarla registra al momento; desmarcarla abre un diálogo de confirmación accesible (`<dialog>`, foco en «Cancelar») que avisa de que la retención se recalcula y puede quedar vencida; con uno vigente, un botón «Renovar consentimiento» | PENDIENTE | Abierta |
| OQ-03 | Si se vuelve a otorgar el consentimiento tras retirarlo, ¿se sustituyen las fechas anteriores o se guarda un historial de consentimientos? | S-07 solo exige conservar la fecha de otorgamiento y la de retirada al retirar; nada dice de un segundo otorgamiento. Decide si basta una columna por dato o hace falta una tabla de historial | Un único estado por candidato: el nuevo otorgamiento sustituye la fecha y la versión y vacía la fecha de retirada (minimización, RGPD §1; acredita la base vigente) | PENDIENTE | Abierta |
| OQ-04 | ¿Cómo elige el reclutador la skill del filtro y cómo pagina en la web? | UC-11 · A2 dice «elige una sola skill» (¿texto libre o desplegable de las existentes, que pide otro endpoint?) y UC-11 · A4, «pide otra página o un tamaño de hasta 100», sin fijar los controles | Campo de texto «Skill» (coincidencia exacta tras recortar y pasar a minúsculas) junto a `q`, con un botón «Buscar» que aplica los dos; «Anterior» y «Siguiente» con «Página N de M»; selector de tamaño 20, 50 o 100 | PENDIENTE | Abierta |
| OQ-05 | ¿Cómo se lee exactamente la regla del teléfono de S-03? | «"+" opcional y 6-20 caracteres entre dígitos, espacios, guiones y paréntesis» no dice si el «+» cuenta en los 6-20 ni si «------» es válido; tampoco si se normaliza al guardar | «+» opcional al principio y fuera de la cuenta; después, 6-20 caracteres de dígitos, espacios, guiones y paréntesis con al menos 6 dígitos; se guarda recortado, tal cual se escribió | PENDIENTE | Abierta |
| OQ-06 | ¿Se rechazan los caracteres de control en los campos de la ficha? | S-03 solo los prohíbe en `q`; un salto de línea en el nombre o en una skill rompe la lista y la ficha, pero el resumen es texto largo | 400 si nombre, email, teléfono o una skill traen caracteres de control; en el resumen se permiten salto de línea y tabulador y se rechazan los demás | PENDIENTE | Abierta |
| OQ-07 | ¿Cómo se coordinan con HU-01 las piezas transversales que las dos necesitan? | `hu.md` dice «Depende de: nada», pero HU-01 crea en paralelo el manejador de errores con el envelope, el reloj inyectado (DEC-09), la navegación de la web y la migración `001`. Si las dos las crean, chocan en el merge | `/tech-design` de HU-03 parte de `main` con HU-01 ya integrada (se actualiza la rama antes de diseñar) y reutiliza esas piezas; la migración toma el siguiente número libre en `main`. Si HU-01 no está en `main`, HU-03 crea las piezas con la misma forma que el PRD de HU-01 y quien llegue segundo a `main` integra | PENDIENTE | Abierta |
| OQ-08 | ¿Qué candidatos carga el seed? | RV-26 fija «unos 30» inventados con `@example.com`; la mezcla de consentimientos, skills y fechas de alta queda abierta, y HU-04 inscribirá a algunos | 30 candidatos con altas escalonadas en los 150 días anteriores al `db:reset` (ninguno vencido): 10 con consentimiento vigente, 4 con consentimiento retirado y 16 sin él; skills de un conjunto de unas 12 (`typescript`, `sql`, `react`, `node.js`, `python`, `java`, `figma`, `scrum`, `docker`, `aws`, `excel`, `ventas`); retención con la función de RF-07 | PENDIENTE | Abierta |

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| — | — | — | — | — |

## Criterios de aceptación

Fechas de ejemplo con el reloj inyectado (DEC-09). Todos los datos son inventados.

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-09 · P / RF-01, RF-02 | que no existe `lucia.ferrer@example.com` y el reloj marca 2026-10-06T09:00:00Z | doy de alta a «Lucía Ferrer Soler» con `Lucia.Ferrer@Example.com ` y las skills `TypeScript, sql, typescript,   ` | la API responde 201; se guardan el email `lucia.ferrer@example.com` y las skills `typescript, sql`; el consentimiento queda sin dar; el fin de retención es 2027-04-06 y veo su ficha con 06/04/2027 |
| CA-02 | UC-09 · P / RF-07 | altas el 2026-10-06T22:30:00Z, el 2026-08-31 y el 2027-08-31 | se calcula su retención | vencen el 2027-04-07 (día natural en Europe/Madrid), el 2027-02-28 y el 2028-02-29 |
| CA-03 | UC-09 · A1 / RF-01 | el formulario de alta, con el texto del consentimiento y su versión junto a la casilla, y el reloj en 2026-10-06T09:00:00Z | marco la casilla y guardo | se guardan la fecha del consentimiento (la del reloj) y la versión vigente del texto, y el fin de retención es 2028-10-06 (consentimiento + 24 meses) |
| CA-04 | UC-09 · E1 / RF-02 | el formulario de alta | envío un nombre de 1 o 101 caracteres, un nombre «   », un email sin `@` o de 255 caracteres, el teléfono «abc123», 21 skills distintas, una skill de 41 caracteres, `retentionEndsAt` o un campo desconocido | la API responde 400 `VALIDATION_ERROR` con el campo en `details`, veo el error junto al campo, el formulario conserva lo escrito y no se guarda nada; con 2 y 100 caracteres de nombre, 20 skills, una skill de 40 o 21 skills que tras deduplicar son 20, se guarda |
| CA-05 | UC-09 · E2 / RF-01 | que existe `lucia.ferrer@example.com` | doy de alta otro candidato con `LUCIA.FERRER@example.com`, también con doble clic en «Guardar» | recibo 409 `DUPLICATE` con el ID del existente en `details`; el mensaje no repite el email; no se guarda nada y sigue habiendo un solo candidato con ese email |
| CA-06 | UC-09 · E3 / RF-01 | que la escritura en la base falla al guardar un alta | envío el formulario | recibo 500 `INTERNAL_ERROR` en el envelope sin datos personales; no existe ningún candidato nuevo; el formulario conserva lo escrito |
| CA-07 | UC-10 · P / RF-03 | un candidato con fin de retención 2027-04-06 y sin consentimiento | cambio su teléfono a « +34 600 000 001 », su resumen y sus skills a `SQL, Python` y guardo | la ficha muestra `+34 600 000 001`, el resumen nuevo y `sql, python`; el fin de retención sigue en 2027-04-06 y el consentimiento no cambia |
| CA-08 | UC-10 · A1 / RF-03 | un candidato | cambio su email por ` Nuevo.Correo@Example.com ` que no usa nadie | se guarda `nuevo.correo@example.com` |
| CA-09 | UC-10 · A2 / RF-03 | un candidato con `jose.ruiz@example.com` | guardo ` Jose.Ruiz@Example.com` | 200; el email sigue siendo `jose.ruiz@example.com` y no hay 409 |
| CA-10 | UC-10 · A3 / RF-03 | un candidato | guardo la ficha sin cambiar nada | 200 con la misma ficha; ni los datos, ni el consentimiento, ni el fin de retención cambian |
| CA-11 | UC-10 · E1 / RF-02, RF-03 | un candidato | lo edito con un resumen de 2 001 caracteres, el nombre vacío o `retentionEndsAt` | 400 `VALIDATION_ERROR` junto al campo y la ficha no cambia; un resumen de 2 000 se guarda |
| CA-12 | UC-10 · E2 / RF-03 | dos candidatos | le pongo a uno el email del otro | 409 `DUPLICATE` con el ID del otro en `details`, sin el email en el mensaje; la ficha no cambia |
| CA-13 | UC-10 · E3 / RF-03 | un ID de candidato que no existe | intento editarlo | 404 `NOT_FOUND` sin datos |
| CA-14 | UC-10 · E4 / RF-03 | que la escritura en la base falla al guardar una edición | envío el formulario | 500 `INTERNAL_ERROR` sin datos personales; la ficha no cambia; el formulario conserva lo escrito |
| CA-15 | UC-11 · P / RF-04 | «José Ruiz» (`jose.ruiz@example.com`) entre otros candidatos | busco `q=jose` o `q=ruiz@exa` | aparece en el listado, que muestra solo nombre, email y skills, ordenado por alta (la más reciente primero) y de 20 en 20 |
| CA-16 | UC-11 · A1 / RF-04 | 25 candidatos | abro el listado sin filtros | veo los 20 dados de alta más recientemente; la API devuelve `total` 25, `page` 1 y `pageSize` 20 |
| CA-17 | UC-11 · A2 / RF-04 | «José Ruiz» con la skill `sql` y «José Martín» sin ella | busco `q=jose` con el filtro de skill `SQL` | solo aparece «José Ruiz» |
| CA-18 | UC-11 · A3 / RF-04 | que ningún candidato coincide | busco | veo el estado vacío con un mensaje que lo explica |
| CA-19 | UC-11 · A4 / RF-04 | 25 candidatos | pido la segunda página; después `pageSize=100`; después la página 3 de 20 | veo los 5 restantes; `pageSize=100` devuelve los 25; la página 3 devuelve `items` vacío con `total` 25 |
| CA-20 | UC-11 · E1 / RF-04 | el listado | busco con un `q` de 101 caracteres o con un carácter de control, o pido `pageSize=101` | 400 `VALIDATION_ERROR` en el envelope, sin repetir `q` en el mensaje ni en `details`; un `q` de 100 caracteres se acepta y `' OR 1=1 --` se busca de forma literal (0 resultados) |
| CA-21 | UC-11 · E2 / RF-04 | que la API no responde | busco candidatos con `q` y skill | veo el estado de error con «Reintentar»; los filtros siguen escritos y se reenvían al reintentar |
| CA-22 | UC-12 · P / RF-05 | un candidato con consentimiento vigente, otro con el consentimiento retirado y otro que nunca lo dio, uno de ellos con el resumen `<script>alert(1)</script>` | abro sus fichas | veo todos sus datos; el resumen se ve como texto; el consentimiento (fecha y versión; fechas de otorgamiento y de retirada; o que no hay) y el fin de retención en `dd/mm/aaaa`, en solo lectura |
| CA-23 | UC-12 · E1 / RF-05 | un ID de candidato que no existe | abro su ficha | la API responde 404 `NOT_FOUND` sin datos y veo «Candidato no encontrado» |
| CA-24 | UC-12 · E2 / RF-05 | que la API no responde | abro una ficha | veo el estado de error con «Reintentar» |
| CA-25 | UC-13 · P / RF-06, RF-07 | un candidato sin consentimiento y el reloj en 2026-10-06T09:00:00Z | registro su consentimiento | se guardan la fecha (2026-10-06T09:00:00Z) y la versión del texto, y el fin de retención pasa a 2028-10-06, en la misma transacción |
| CA-26 | UC-13 · A1 / RF-06, RF-07 | un candidato sin inscripciones dado de alta el 2026-02-06, con consentimiento del 2026-03-01, y el reloj en 2026-10-06 | retiro el consentimiento | se conservan la fecha de otorgamiento (2026-03-01) y la versión, se guarda la de retirada (2026-10-06) y el fin de retención es 2026-08-06 (alta + 6 meses) aunque ya haya pasado |
| CA-27 | UC-13 · A2 / RF-06 | un candidato con consentimiento vigente del 2026-03-01 | lo renuevo con el reloj en 2026-10-06 | se guardan la nueva fecha y la versión vigente, y el fin de retención es 2028-10-06 |
| CA-28 | UC-13 · A3 / RF-06 | un candidato que nunca dio el consentimiento y otro que ya lo retiró | pido retirarlo | 200 sin cambios; no se toca ninguna fecha ni el fin de retención |
| CA-29 | UC-13 · E1 / RF-06 | un ID de candidato que no existe | registro o retiro su consentimiento | 404 `NOT_FOUND` sin datos |
| CA-30 | UC-13 · E2 / RF-06, RF-07 | que falla una escritura al cambiar el consentimiento (fallo inyectado en el recálculo) | lo registro o lo retiro | recibo 500 `INTERNAL_ERROR` en el envelope y ni el consentimiento ni el fin de retención cambian |
| CA-31 | UC-13 · P, A1 / RF-07 | la fórmula de retención con un puerto de procesos de prueba | se evalúa con cada fila de `docs/RGPD.md` §3 (inscripción abierta → sin fecha de fin; proceso cerrado sin consentimiento → cierre + 6 meses; consentimiento vigente → consentimiento + 24 meses; sin inscripciones ni consentimiento → alta + 6 meses) y con varias a la vez (EC-52) | da la fecha de cada fila y, con varias, la más tardía; y el puerto por defecto de la app responde «sin inscripciones», así que todo candidato de esta HU tiene fecha de fin |
| CA-32 | UC-09 · E1, E2, E3; UC-11 · E1 / RNF-03 | el logger capturado en los tests | hago un alta, una edición, una búsqueda con `q=lucia.ferrer@example.com`, un cambio de consentimiento y cada error de CA-04, CA-05, CA-06 y CA-20 | ni los logs ni los mensajes y `details` de error contienen el nombre, el email, el teléfono, el resumen ni el texto de `q` |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.
