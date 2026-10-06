# HU-01 — Crear, editar y consultar ofertas en borrador — PRD

## Info
- **HU:** HU-01 · **Feature:** FEAT-01
- **Scope:** fullstack
- **Módulos:** `ofertas` (código `jobs`)
- **Fecha:** 2026-10-06
- **Estado:** Ready

## Contexto

### Problema
El reclutador no tiene dónde preparar sus ofertas. Sin ofertas no hay dónde inscribir candidatos (IDEA-001), y
publicar exige todos los campos obligatorios (RV-02): necesita poder empezar con poco, completar más tarde, borrar lo
que sobra y encontrar lo que ya tiene.

### Situación actual
Solo existe el esqueleto del monorepo:
- **API:** la única ruta es `GET /api/health` (`apps/api/src/app.ts`). No hay tablas de dominio
  (`apps/api/src/db/schema.sql` solo crea `schema_migrations`; `apps/api/src/db/migrations/` está vacía), ni módulos
  (`apps/api/src/modules/` vacía), ni manejador de errores con el envelope de DEC-01, ni reloj inyectable (DEC-09).
  El seed (`apps/api/src/db/seed.ts`) es una función vacía. Los tests montan `openDatabase(':memory:')` + `migrate` +
  `buildApp` + `inject` (`apps/api/test/health.test.ts`).
- **Web:** una sola pantalla (`apps/web/src/App.tsx`) que muestra el estado de la API; sin router, sin
  `apps/web/src/features/jobs/` ni componentes compartidos (`apps/web/src/components/` vacía), sin cliente de API ni
  formato de fechas. Tests en `apps/web/test/` con Testing Library.
- **E2E:** un smoke (`e2e/smoke.spec.ts`) sobre `data/e2e.db`.

### Resultado esperado
El módulo `ofertas` existe en API y web, con su migración y su seed: el reclutador crea ofertas en `draft` con solo
el título, las completa y corrige, borra las que no necesita, consulta su ficha y las ve en un listado con los 20 más
recientes. Los errores llegan en el envelope de DEC-01 y se muestran junto al campo.

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-01 · P | Crear un borrador con solo el título o con todos los campos | CA-01, CA-02 |
| UC-01 · E1 | Título ausente, de solo espacios o fuera de 3-120 | CA-03 |
| UC-01 · E2 | Descripción de más de 5 000 caracteres | CA-04 |
| UC-01 · E3 | Modalidad fuera de `presencial`, `híbrida`, `remota` | CA-05 |
| UC-01 · E4 | Ubicación fuera de 2-120 tras recortar | CA-06 |
| UC-01 · E5 | Banda salarial inválida | CA-07 |
| UC-01 · E6 | Campo desconocido o de solo lectura | CA-08 |
| UC-02 · P | Editar un borrador | CA-09, CA-10 |
| UC-02 · A1 | Edición concurrente: gana la última escritura | CA-11 |
| UC-02 · E2 | Campo inválido al editar | CA-12 |
| UC-05 · P | Borrar un borrador | CA-13 |
| UC-05 · E2 | Borrar un borrador ya borrado | CA-14 |
| UC-07 · P | Listado: primera página de 20, orden y fecha en Europe/Madrid | CA-15, CA-16 |
| UC-07 · A2 | Listado vacío | CA-17 |
| UC-07 · E4 | API no disponible desde la web | CA-18 |
| UC-08 · P | Ficha con todos los campos, escapados, y acciones de borrador | CA-19 |
| UC-08 · E1 | Oferta inexistente | CA-20 |

Ficheros de los UC: `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-05-borrar-borrador.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` y
`docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md`.

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | **Crear un borrador.** Formulario «Nueva oferta» y alta en la API: título obligatorio; descripción, ubicación, modalidad y extremos de la banda salarial opcionales. Se recortan los espacios de los textos antes de validar y un texto opcional que queda vacío se guarda sin valor (S-03). Se guarda en `draft` con la fecha de creación en UTC que pone el sistema (reloj inyectado, DEC-09); la respuesta es 201 con la oferta completa y la web abre su ficha (UC-01 · P). | Must | backend + frontend | - [ ] CA-01 a CA-08 |
| RF-02 | **Validar los campos de una oferta** (alta y edición, misma regla): título 3-120; descripción ≤ 5 000; ubicación 2-120; modalidad exactamente `presencial`, `híbrida` o `remota`; cada extremo de la banda, entero > 0, y mínimo ≤ máximo si vienen los dos (RN-03, RN-04, S-08). Esquema estricto: un campo desconocido o de solo lectura (estado, fechas, ID) da 400 (S-03, DEC-07). El error es 400 `VALIDATION_ERROR` con los campos en `details`, y la web lo muestra junto a cada campo con el `message` de la API (diseño §4). La web valida también en el cliente con las mismas reglas, solo para la experiencia. | Must | backend + frontend | - [ ] CA-03 a CA-08 y CA-12 |
| RF-03 | **Editar un borrador.** Desde la ficha, «Editar» abre el formulario con los valores actuales; al guardar se aplican los campos enviados con las reglas de RF-02, sin cambiar el estado ni la fecha de creación; un campo opcional vaciado queda sin valor; gana la última escritura (S-02, DEC-08). Respuesta 200 con la oferta y la web vuelve a la ficha (UC-02 · P, A1, E2). | Must | backend + frontend | - [ ] CA-09 a CA-12 |
| RF-04 | **Borrar un borrador.** «Borrar» en la ficha, con un diálogo de confirmación accesible (`<dialog>` con el foco inicial en «Cancelar») que nombra la oferta y avisa de que no se puede deshacer (DT-02); borrado físico (S-12); respuesta 204 y la web vuelve al listado. Si la oferta ya no existe, 404 `NOT_FOUND` (UC-05 · P, E2). | Must | backend + frontend | - [ ] CA-13, CA-14 |
| RF-05 | **Listar ofertas.** Primera página de 20 ofertas, de todos los estados, ordenadas por fecha de referencia (publicación o, si no hay, creación) de la más reciente a la más antigua, con desempate por ID descendente (RN-11, S-04). Respuesta con la forma de DEC-10 (`items`, `total`, `page`, `pageSize`) y solo los campos de la lista: ID, título, estado y fecha de referencia. La web muestra cada oferta con su título (enlace a la ficha), su estado y su fecha en `dd/mm/aaaa` en Europe/Madrid, más los estados *cargando*, *vacío* y *error* (diseño §3). Filtros, cambio de página y de tamaño: HU-02. | Must | backend + frontend | - [ ] CA-15 a CA-18 |
| RF-06 | **Consultar una oferta.** La ficha muestra título, descripción, ubicación, modalidad, banda salarial, estado y fecha de creación en `dd/mm/aaaa` (Europe/Madrid), con el título y la descripción como texto (sin HTML interpretado), y las acciones que existen en esta HU para un borrador: «Editar» y «Borrar». Un ID inexistente da 404 `NOT_FOUND` y la pantalla muestra un mensaje sin datos (UC-08 · P, E1). | Must | backend + frontend | - [ ] CA-19, CA-20 |
| RF-07 | **Migración y seed.** Una migración nueva crea la tabla de ofertas con los campos de §Modelo de datos y las restricciones de RN-01 a RN-04; `npm run db:reset` carga **4 borradores** inventados con fechas de creación escalonadas (DT-01), todos con los campos de RN-02 informados y válidos (RV-26). | Should | backend | - [ ] tras `npm run db:reset`, `GET /api/jobs` devuelve los 4 borradores del seed, dos de ellos con banda salarial, y todos cumplen RN-02 a RN-04 |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Lecturas de la API | Rendimiento | `GET /api/jobs` y `GET /api/jobs/:id` < 200 ms por petición con 100 ofertas en la base, medido con `fastify.inject` en local |
| RNF-02 | Acciones de la API | Rendimiento | `POST`, `PATCH` y `DELETE` < 500 ms por petición con 100 ofertas en la base, con `fastify.inject` en local |
| RNF-03 | Errores sin detalles internos | Seguridad | 0 respuestas de error fuera del envelope `{ error: { code, message, details? } }` y 0 con *stack trace*, también en rutas `/api` inexistentes y en JSON malformado |
| RNF-04 | Texto libre sin HTML interpretado | Seguridad | 0 elementos HTML creados a partir del título o la descripción: `<b>x</b>` se ve como texto literal en la ficha y en el listado |
| RNF-05 | Accesibilidad de las pantallas | Accesibilidad | 100 % de los controles de formulario con `<label>` asociado y localizables por rol y nombre en Testing Library; mensajes de estado con `role="status"` o `role="alert"` |

## Modelo de datos
- **Migración nueva** `apps/api/src/db/migrations/001-<descripción>.sql` (nombre exacto en el diseño): tabla de
  ofertas (`JobOpening`) con:
  - ID entero autoincremental (convención de `docs/ARCHITECTURE.md`).
  - Título (texto, obligatorio), descripción, ubicación y modalidad (texto, opcionales; la modalidad restringida a
    `presencial`, `híbrida`, `remota`), salario mínimo y máximo (enteros > 0, opcionales; mínimo ≤ máximo si vienen
    los dos).
  - Estado (`draft | published | closed`, por defecto `draft`; en esta HU solo se crea `draft`).
  - Fecha de creación (ISO 8601 UTC, obligatoria) y fechas de publicación y cierre (ISO 8601 UTC, nulas en esta HU;
    las rellena HU-02). Se crean ya aquí para no tener que migrar la tabla en HU-02.
- **Restricciones en la base** (`CHECK`) que refuerzan RN-03, RN-04 e INV-01 e INV-07, además de la validación de la
  API.
- **Datos personales:** ninguno.

## Interfaces / endpoints / pantallas

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/jobs` | Nuevo | Crea un borrador. 201 con la oferta · 400 `VALIDATION_ERROR` |
| GET | `/api/jobs` | Nuevo | Primera página (20) del listado, forma DEC-10 · 200. Sin parámetros en esta HU (llegan en HU-02) |
| GET | `/api/jobs/:id` | Nuevo | Ficha · 200 · 400 `VALIDATION_ERROR` (ID no entero) · 404 `NOT_FOUND` |
| PATCH | `/api/jobs/:id` | Nuevo | Edita campos de un borrador · 200 · 400 `VALIDATION_ERROR` · 404 `NOT_FOUND` |
| DELETE | `/api/jobs/:id` | Nuevo | Borra un borrador · 204 · 404 `NOT_FOUND` |
| — | Manejador de errores de la API | Nuevo | Toda respuesta de error en el envelope de DEC-01, incluidas las rutas `/api` inexistentes (404 `NOT_FOUND`) y el cuerpo JSON malformado (400 `VALIDATION_ERROR`); sin *stack traces* |
| Pantalla | Listado de ofertas | Nueva | Tabla con título, estado y fecha; botón «Nueva oferta»; estados cargando, vacío y error. Es la pantalla de entrada de la web |
| Pantalla | Formulario de oferta (alta y edición) | Nueva | Campos con `<label>`, errores junto al campo, «Guardar» y «Cancelar» |
| Pantalla | Ficha de oferta | Nueva | Campos, estado, fecha de creación; «Editar» y «Borrar» con confirmación; mensaje si no existe |

Cómo se navega entre pantallas (URL de cada una, con o sin dependencia nueva) lo decide `/tech-design`; si añade una
dependencia, la justifica en un `DEC-NN` (DEC-05).

## Flujos de usuario
1. **Alta:** listado → «Nueva oferta» → formulario → «Guardar» → ficha de la oferta nueva. Si hay errores, se quedan
   junto a cada campo y no se sale del formulario.
2. **Edición:** ficha → «Editar» → formulario con los valores actuales → «Guardar» → ficha actualizada. «Cancelar»
   vuelve a la ficha sin cambios.
3. **Borrado:** ficha → «Borrar» → confirmación → listado, donde ya no aparece. Si se cancela la confirmación, no pasa
   nada.
4. **Consulta:** listado → título de la oferta → ficha.

## Datos personales
No aplica — la oferta no contiene datos personales (FEAT-01, «Datos y conceptos clave»; RGPD §1). Esta HU no toca
`Candidate`, `Application` ni `StageChange`. Igualmente, los logs siguen sin registrar cuerpos ni query strings
(`apps/api/src/logger.ts`).

## Edge cases

Las 7 categorías de `QUALITY-GATES.md` §3, evaluadas por cada RF Must. RF-07 (Should) no las exige.

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | Cuerpo que no es JSON o que no es un objeto (`[]`, `"x"`) | 400 `VALIDATION_ERROR`; no se crea nada |
| EC-02 | RF-01 | 1 Input inválido | Trae `status: "published"`, `createdAt` o `id` | 400 `VALIDATION_ERROR` con el campo en `details`; no se crea nada (UC-01 · E6) |
| EC-03 | RF-01 | 2 Boundary | Título «  Técnica/o de selección  » con espacios alrededor | Se guarda recortado: «Técnica/o de selección» |
| EC-04 | RF-01 | 2 Boundary | Título con tildes, eñes y emoji («Diseñador/a UX 🎨»), 3 y 120 caracteres | Se acepta y se devuelve igual; la longitud cuenta caracteres, no bytes |
| EC-05 | RF-01 | 3 Fallo de dependencia | La escritura en SQLite falla | 500 en el envelope (`INTERNAL_ERROR`), sin *stack trace*; no queda ninguna oferta a medias; la web muestra el error sin salir del formulario |
| EC-06 | RF-01 | 4 Concurrencia | Doble clic en «Guardar» del alta | La web deshabilita «Guardar» mientras la petición está en curso, así que solo sale una petición; dos peticiones que lleguen a la API crean dos borradores (DT-03: sin clave natural no hay idempotencia) |
| EC-07 | RF-01 | 5 Datos corruptos | — | N/A — el módulo nace con esta HU: no hay filas anteriores a la migración |
| EC-08 | RF-01 | 6 Seguridad | Título `'); DROP TABLE …; --` | Se guarda como texto literal con sentencias preparadas; la tabla sigue intacta |
| EC-09 | RF-01 | 7 Idempotencia | Reintento del alta tras un error de red | Puede crear un segundo borrador; el reclutador lo borra (RF-04). Aceptado: sin clave natural no hay idempotencia (DT-03) |
| EC-10 | RF-02 | 1 Input inválido | Modalidad «teletrabajo», «Híbrida» o «hibrida» | 400 `VALIDATION_ERROR` en `workMode` (o el nombre que fije el diseño); solo valen los tres literales exactos |
| EC-11 | RF-02 | 1 Input inválido | Salario `"40000"` (cadena), `40000.5`, `0` o `-1` | 400 `VALIDATION_ERROR` en ese extremo |
| EC-12 | RF-02 | 2 Boundary | Título de 2/3/120/121, descripción de 5 000/5 001, ubicación de 1/2/120/121 caracteres tras recortar | Se aceptan 3, 120, 5 000, 2 y 120; el resto, 400 |
| EC-13 | RF-02 | 2 Boundary | Mínimo = máximo (40 000-40 000); solo el mínimo; solo el máximo | Se aceptan los tres |
| EC-14 | RF-02 | 3 Fallo de dependencia | — | N/A — la validación es pura (esquema y reglas en memoria) y no usa la base |
| EC-15 | RF-02 | 4 Concurrencia | — | N/A — la validación no tiene estado compartido |
| EC-16 | RF-02 | 5 Datos corruptos | Una fila con mínimo > máximo insertada saltándose la API | La base la rechaza por su `CHECK` (INV-07) |
| EC-17 | RF-02 | 6 Seguridad | Descripción de 1 MB | 400 por longitud (o 413 del límite de cuerpo de Fastify, en el envelope); no se guarda |
| EC-18 | RF-02 | 7 Idempotencia | — | N/A — validar dos veces la misma entrada da el mismo resultado; no tiene efectos |
| EC-19 | RF-03 | 1 Input inválido | `PATCH` con `{}` (sin campos) | 400 `VALIDATION_ERROR`: hay que enviar al menos un campo |
| EC-20 | RF-03 | 1 Input inválido | `PATCH` que vacía el título (`""` o solo espacios) | 400 `VALIDATION_ERROR` en el título; el borrador queda como estaba (UC-02 · E2) |
| EC-21 | RF-03 | 2 Boundary | `PATCH` que vacía la descripción de un borrador | 200; la descripción queda sin valor (un borrador solo exige el título, RN-01) |
| EC-22 | RF-03 | 3 Fallo de dependencia | La escritura en SQLite falla al editar | 500 en el envelope; el borrador queda como estaba |
| EC-23 | RF-03 | 4 Concurrencia | Dos pestañas guardan el mismo borrador | Gana la última escritura, campo a campo de lo que envía cada una (UC-02 · A1, DEC-08) |
| EC-24 | RF-03 | 5 Datos corruptos | `PATCH` sobre una oferta borrada mientras se editaba | 404 `NOT_FOUND`; la web muestra el mensaje y ofrece volver al listado |
| EC-25 | RF-03 | 6 Seguridad | `PATCH` con `status`, `createdAt` o `id` | 400 `VALIDATION_ERROR`; nada cambia (S-03) |
| EC-26 | RF-03 | 7 Idempotencia | El mismo `PATCH` dos veces | 200 las dos; el borrador queda igual que tras el primero |
| EC-27 | RF-04 | 1 Input inválido | `DELETE /api/jobs/abc` | 400 `VALIDATION_ERROR` (el ID no es entero); nada cambia |
| EC-28 | RF-04 | 2 Boundary | Borrar el único borrador | 204; el listado muestra el estado «vacío» |
| EC-29 | RF-04 | 3 Fallo de dependencia | La escritura en SQLite falla al borrar | 500 en el envelope; el borrador sigue existiendo |
| EC-30 | RF-04 | 4 Concurrencia | Borrar en una pestaña mientras se edita en otra | El `PATCH` posterior da 404 (EC-24) |
| EC-31 | RF-04 | 5 Datos corruptos | — | N/A — un borrador no puede tener inscripciones (RV-17) y el módulo nace con esta HU |
| EC-32 | RF-04 | 6 Seguridad | Borrar IDs secuenciales ajenos (enumeración) | Sin impacto en datos personales: la oferta no los tiene y la API solo escucha en `127.0.0.1` (DEC-04) |
| EC-33 | RF-04 | 7 Idempotencia | Doble clic en «Borrar» (segunda petición) | 404 `NOT_FOUND` con el envelope; no cambia nada (UC-05 · E2, S-12) |
| EC-34 | RF-05 | 1 Input inválido | `GET /api/jobs?page=2` u otro parámetro en esta HU | 400 `VALIDATION_ERROR` (esquema estricto; los parámetros llegan con HU-02) |
| EC-35 | RF-05 | 2 Boundary | 0, 20 y 21 ofertas | 0 → `items` vacío y estado «vacío»; 20 → 20 ofertas, `total` 20; 21 → 20 ofertas, `total` 21 |
| EC-36 | RF-05 | 2 Boundary | Oferta creada el 2026-10-06T22:30:00Z | Se muestra 07/10/2026 (Europe/Madrid, UTC+2) |
| EC-37 | RF-05 | 2 Boundary | Dos ofertas con la misma fecha de creación | Primero la de ID mayor |
| EC-38 | RF-05 | 3 Fallo de dependencia | La API no responde o devuelve 500 | Estado «error» con `role="alert"`, sin filas a medias (UC-07 · E4) |
| EC-39 | RF-05 | 4 Concurrencia | — | N/A — lectura sin efectos; una oferta creada a la vez aparece o no según el instante de la lectura, sin inconsistencias |
| EC-40 | RF-05 | 5 Datos corruptos | — | N/A — el módulo nace con esta HU y la base impone las restricciones (EC-16) |
| EC-41 | RF-05 | 6 Seguridad | Título `<img src=x onerror=alert(1)>` | Se ve como texto en el listado; no se ejecuta nada (RNF-04) |
| EC-42 | RF-05 | 7 Idempotencia | — | N/A — `GET` sin efectos |
| EC-43 | RF-06 | 1 Input inválido | `GET /api/jobs/abc` o `/api/jobs/1.5` | 400 `VALIDATION_ERROR`; la pantalla muestra el mismo mensaje que para una oferta inexistente |
| EC-44 | RF-06 | 2 Boundary | Borrador con solo el título | La ficha muestra los demás campos como «Sin indicar», sin huecos ni `null` |
| EC-45 | RF-06 | 3 Fallo de dependencia | La API no responde al abrir la ficha | Estado «error» con `role="alert"`, sin datos a medias |
| EC-46 | RF-06 | 4 Concurrencia | La oferta se borra en otra pestaña con la ficha abierta | La acción siguiente («Editar» → guardar, o «Borrar») recibe 404 y la web lo muestra |
| EC-47 | RF-06 | 5 Datos corruptos | — | N/A — el módulo nace con esta HU |
| EC-48 | RF-06 | 6 Seguridad | Descripción con `<script>` y `<b>` | Se muestra como texto literal (RNF-04); la API devuelve el texto tal cual, sin sanear |
| EC-49 | RF-06 | 7 Idempotencia | — | N/A — `GET` sin efectos |

## Decisiones aplicables
- **DEC-01** (stack y envelope de errores): Fastify con JSON Schema por ruta, `node:sqlite`, React + Vite; errores en
  `{ error: { code, message, details? } }` (RF-02, RNF-03).
- **DEC-03** (la `.db` no se versiona): la tabla nace en una migración nueva y el seed es inventado (RF-07).
- **DEC-04** (sin login, rol único): no hay permisos por rol; la seguridad se centra en inyección, HTML y tamaño
  (EC-08, EC-17, EC-32, EC-41).
- **DEC-05** (dependencias): si el diseño necesita una dependencia nueva (p. ej., un router), la justifica en un
  `DEC-NN`.
- **DEC-06** (módulos): `ofertas` es dueño de su tabla. En esta HU no invoca a ningún otro módulo.
- **DEC-07** (códigos HTTP): 201 alta, 200 lectura y edición, 204 borrado, 400 `VALIDATION_ERROR` con `details`,
  404 `NOT_FOUND`.
- **DEC-08** (concurrencia): las ediciones, última escritura (EC-23).
- **DEC-09** (fechas y reloj): fechas ISO 8601 UTC, mostradas en Europe/Madrid como `dd/mm/aaaa`; reloj inyectado en
  la API para fijar la fecha de creación en los tests (CA-16).
- **DEC-10** (listados): forma `{ items, total, page, pageSize }`, `pageSize` 20, desempate por ID y solo los campos
  de la lista (RF-05). Los parámetros `page`, `pageSize`, `status` y `q` llegan con HU-02.

## Fuera de scope
- Publicar, cerrar y duplicar ofertas, y sus acciones en la ficha (HU-02: UC-03, UC-04, UC-06).
- Editar o borrar ofertas `published` o `closed` y sus errores (HU-02: UC-02 · E1, E3, E4 y UC-05 · E1).
- Filtros por estado y por título, cambio de página y de tamaño y sus validaciones (HU-02: UC-07 · A1, A3, E1-E3).
- Ficha de una oferta cerrada (HU-02: UC-08 · A1).
- Las 6 ofertas restantes del seed, 4 `published` y 2 `closed` (HU-02, DT-01).
- Cualquier relación con candidatos o inscripciones (FEAT-02, FEAT-03).
- Número de vacantes (RV-07), portales externos y login (DEC-04).

## Open Questions

No hay preguntas abiertas.

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| DT-01 | (OQ-01) El seed de HU-01 carga 4 borradores inventados y completos (título, descripción, ubicación y modalidad; dos con banda salarial), con fechas de creación escalonadas. HU-02 añade los 6 restantes (4 `published` y 2 `closed`) hasta las 10 de RV-26 | `hu.md` delega el reparto en los PRD de HU-01 y HU-02; el seed solo trae ofertas que cumplen RN-02 a RN-04 | RF-07; Fuera de scope | 2026-10-06 |
| DT-02 | (OQ-02) El borrado se confirma en un `<dialog>` accesible, con el foco inicial en «Cancelar», que nombra la oferta y avisa de que no se puede deshacer | FEAT-01 (Riesgos) deja al PRD cómo presentar un borrado físico e irreversible (S-12) | RF-04; CA-13 | 2026-10-06 |
| DT-03 | **Sin clave natural no hay idempotencia.** Una oferta no tiene ningún campo único (dos ofertas pueden llamarse igual), así que la API no puede distinguir un reintento del alta de un alta nueva: dos `POST` crean dos borradores. La defensa es de la web (deshabilita «Guardar» mientras envía) y el remedio, borrar el sobrante (RF-04). Contrasta con candidatos (email único, RV-10) e inscripciones (pareja única, RV-18), donde la base sí lo impide (DEC-08) | Decisión de ingeniería, coherente con DEC-08 (la unicidad la garantiza un índice cuando existe una clave natural) | EC-06, EC-09 | 2026-10-06 |
| DT-04 | Decisiones de ingeniería coherentes con S-03, DEC-07 y DEC-10: desempate del listado por ID descendente; ID no entero → 400 `VALIDATION_ERROR`; `PATCH` con `{}` → 400 y un opcional vaciado queda sin valor; fallo de la base → 500 `INTERNAL_ERROR` en el envelope; `GET /api/jobs` sin parámetros en esta HU (llegan con HU-02); las columnas de publicación y cierre se crean ya en la migración de esta HU | Sin fuente literal en RV ni S; aceptadas al aprobar el PRD | RF-03, RF-05; EC-19, EC-27, EC-34, EC-37, EC-43; Modelo de datos | 2026-10-06 |

## Criterios de aceptación

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-01 · P / RF-01 | el formulario de nueva oferta | guardo solo el título «Desarrollador/a backend (Node.js)» | la API responde 201 con la oferta en `draft` y su fecha de creación (la del reloj inyectado), veo su ficha y aparece en el listado |
| CA-02 | UC-01 · P / RF-01 | el formulario de nueva oferta | guardo «  Técnica/o de selección  », `híbrida`, «Valencia» y 32 000-40 000 €/año | se guarda en `draft` con el título «Técnica/o de selección» y todos esos valores |
| CA-03 | UC-01 · E1 / RF-02 | el formulario de nueva oferta | el título falta, es solo espacios o tiene 2 o 121 caracteres | la API responde 400 `VALIDATION_ERROR` con el título en `details`, veo el error junto al título y no se crea nada; con 3 y con 120 caracteres se crea |
| CA-04 | UC-01 · E2 / RF-02 | el formulario de nueva oferta | la descripción tiene 5 001 caracteres | 400 junto a la descripción y no se crea nada; con 5 000 se crea |
| CA-05 | UC-01 · E3 / RF-02 | el formulario de nueva oferta | la modalidad es «teletrabajo» | 400 y no se crea nada; `presencial`, `híbrida` y `remota` se aceptan |
| CA-06 | UC-01 · E4 / RF-02 | el formulario de nueva oferta | la ubicación tiene 1 o 121 caracteres tras recortar | 400 y no se crea nada; con 2 y con 120 se crea |
| CA-07 | UC-01 · E5 / RF-02 | el formulario de nueva oferta | el salario mínimo es 0, un extremo no es entero o el mínimo (45 000) supera al máximo (40 000) | 400 y no se crea nada; solo el mínimo, solo el máximo o mínimo igual al máximo se aceptan |
| CA-08 | UC-01 · E6 / RF-02 | una petición de alta | trae el estado, una fecha o un campo desconocido | 400 `VALIDATION_ERROR` y no se crea nada |
| CA-09 | UC-02 · P / RF-03 | un borrador | cambio su descripción y su ubicación y guardo | la ficha muestra los valores nuevos, sigue en `draft` y su fecha de creación no cambia |
| CA-10 | UC-02 · P / RF-03 | un borrador con descripción | la vacío y guardo | 200 y la descripción queda sin valor; la ficha muestra «Sin indicar» |
| CA-11 | UC-02 · A1 / RF-03 | un borrador abierto en dos pestañas | guardo en una y después en la otra | queda lo de la última que guardó |
| CA-12 | UC-02 · E2 / RF-02, RF-03 | un borrador | lo edito con un título de 2 caracteres o la modalidad «teletrabajo» | 400, veo el error junto al campo y el borrador queda como estaba |
| CA-13 | UC-05 · P / RF-04 | un borrador | pulso «Borrar» y confirmo | la API responde 204, deja de existir y vuelvo al listado, donde ya no aparece; si cancelo la confirmación, sigue existiendo |
| CA-14 | UC-05 · E2 / RF-04 | un borrador ya borrado | llega otra petición para borrarlo (segundo clic) | 404 `NOT_FOUND` con el envelope de error y no cambia nada |
| CA-15 | UC-07 · P / RF-05 | 25 borradores | abro el listado | veo los 20 más recientes por fecha de creación, con desempate por ID descendente, cada uno con su estado; la API devuelve `total` 25, `page` 1 y `pageSize` 20 |
| CA-16 | UC-07 · P / RF-05 | un borrador creado el 2026-10-06T22:30:00Z | abro el listado | su fecha se muestra como 07/10/2026 |
| CA-17 | UC-07 · A2 / RF-05 | que no hay ninguna oferta | abro el listado | veo el estado «vacío» |
| CA-18 | UC-07 · E4 / RF-05 | que la API no responde | abro el listado | veo el estado «error», sin datos a medias |
| CA-19 | UC-08 · P / RF-06 | un borrador con el título `Oferta <b>X</b>` | abro su ficha | veo todos sus campos, su estado y su fecha de creación en `dd/mm/aaaa`, el `<b>` como texto, y las acciones «Editar» y «Borrar» (ninguna otra) |
| CA-20 | UC-08 · E1 / RF-06 | un ID de oferta que no existe | abro su ficha | la API responde 404 `NOT_FOUND` con el envelope de error y la pantalla muestra un mensaje, sin ningún dato |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.
