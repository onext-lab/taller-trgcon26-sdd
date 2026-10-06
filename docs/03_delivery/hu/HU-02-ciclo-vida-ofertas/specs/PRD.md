# HU-02 — Publicar, cerrar, duplicar y listar ofertas con filtros — PRD

## Info
- **HU:** HU-02 · **Feature:** FEAT-01
- **Scope:** fullstack
- **Módulos:** `ofertas` (código `jobs`)
- **Fecha:** 2026-10-06
- **Estado:** Ready

## Contexto

### Problema
El reclutador ya prepara borradores (HU-01), pero no puede llevarlos más allá: no los publica, que es lo único que
permite inscribir candidatos (RV-17); no da por terminado un proceso; no puede «reabrir» una oferta cerrada, que se
duplica (RV-03); y, a partir de 20 ofertas, no encuentra las demás porque el listado no tiene filtros ni páginas
(RV-08).

### Situación actual
Fuente: `docs/05_modules/ofertas/technical.md` y `docs/05_modules/ofertas/functional.md` (sincronizados hasta HU-01),
comprobado en el código donde se cita.
- **Modelo:** la tabla `job_openings` ya tiene `published_at` y `closed_at` (nulas siempre) y los `CHECK` latentes de
  coherencia estado-fechas (INV-01, INV-05 en lo que toca a fechas) y de obligatorios fuera de `draft` (INV-04)
  (`apps/api/src/db/migrations/001-create-job-openings.sql:15-18`), además del índice por fecha de referencia
  (`:21-22`). HU-02 no necesita, en principio, una migración.
- **API:** `GET /api/jobs` rechaza cualquier parámetro con 400 (`listQuerySchema` vacío en
  `apps/api/src/modules/jobs/schemas.ts:138-142`; test EC-34 en `apps/api/test/jobs/list.test.ts:97`) y devuelve
  siempre la página 1 de 20 (`apps/api/src/modules/jobs/service.ts:83-86`). `update` y `remove` no comprueban el
  estado (`apps/api/src/modules/jobs/service.ts:68-82`), y `remove` no usa transacción. No hay rutas de publicar,
  cerrar ni duplicar, ni código de error 409 (`apps/api/src/errors.ts` solo tiene `notFound` y `validationError`).
  El contrato `Job` ya incluye `publishedAt` y `closedAt`.
- **Web:** la ficha decide las acciones por estado en `JobActions` (`apps/web/src/features/jobs/JobDetails.tsx:9-17`):
  hoy solo «Editar» y «Borrar» en `draft`, y nada en otro estado; solo muestra la fecha de creación. El listado
  (`apps/web/src/features/jobs/JobListScreen.tsx:31-35`) avisa de que muestra «las 20 más recientes de N» en lugar
  de paginar. El diálogo de confirmación accesible ya existe (`apps/web/src/components/ConfirmDialog.tsx`, usado por
  `apps/web/src/features/jobs/DeleteJobAction.tsx`).
- **Seed:** 4 borradores (`apps/api/src/db/seed.ts`), según DT-01 de HU-01.
- **Aviso de la review de HU-01** (`docs/03_delivery/hu/HU-01-ofertas-borrador/review/REVIEW.md` §9): HU-02 comprueba
  el estado en `service.update` y `service.remove`, no solo ocultando botones.

### Resultado esperado
El reclutador publica un borrador completo, lo cierra con confirmación cuando termina el proceso y lo duplica para
reabrirlo; la API rechaza con 409 lo que el estado no permite (publicar una cerrada, cerrar un borrador, editar una
cerrada, borrar una publicada o cerrada) y repetir una transición da 200 sin cambios. El listado se filtra por estado y
por texto del título y se pagina. El seed llega a 10 ofertas. El cierre ya es una transacción con el punto donde
HU-05 conectará el rechazo de inscripciones.

### Dependencias y riesgos
- **Depende de** HU-01 (en `main`). **Bloquea** HU-04 (inscribir exige `published`) y HU-05.
- **Ventana tolerada de INV-05** (`hu.md`, «Notas y dependencias»): entre el merge de HU-04 y el de HU-05, cerrar una
  oferta con inscripciones activas la cierra sin rechazarlas. Es una limitación conocida y declarada, no un defecto de
  esta HU: la cierra HU-05 (UC-04 · A1). Este PRD deja el punto de invocación dentro de la transacción (RF-02, DT-02).

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-02 · E1 | Oferta cerrada: sin «Editar» y 409 en la API | CA-10 |
| UC-02 · E3 | Vaciar un obligatorio de una publicada → 400 | CA-11 |
| UC-02 · E4 | Cerrada mientras se editaba → 409 | CA-12 |
| UC-03 · P | Publicar un borrador completo | CA-01 |
| UC-03 · A1 | Ya publicada → 200 sin cambios | CA-02 |
| UC-03 · E1 | Faltan obligatorios → 400 con la lista | CA-03 |
| UC-03 · E2 | Oferta cerrada → 409 | CA-04 |
| UC-04 · P | Diálogo con el número de inscripciones activas y cierre en una transacción | CA-05 |
| UC-04 · A2 | Cancelar el cierre | CA-06 |
| UC-04 · A3 | Ya cerrada → 200 sin cambios | CA-07 |
| UC-04 · E1 | Borrador → 409 | CA-08 |
| UC-04 · E2 | Fallo durante el cierre → nada cambia | CA-09 |
| UC-05 · E1 | Borrar una publicada o cerrada → sin «Borrar» y 409 | CA-13 |
| UC-06 · P | Duplicar como borrador, desde cualquier estado | CA-14, CA-15 |
| UC-07 · A1 | Filtrar por estado y por título, en Y | CA-16 |
| UC-07 · A3 | Cambiar de página o de tamaño | CA-17, CA-18 |
| UC-07 · E1 | Tamaño de página fuera de rango → 400 | CA-19 |
| UC-07 · E2 | Texto de búsqueda inválido → 400 | CA-20 |
| UC-07 · E3 | Estado de filtro inválido → 400 | CA-21 |
| UC-08 · A1 | Ficha de una oferta cerrada | CA-22 |

Ficheros de los UC: `docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-04-cerrar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-05-borrar-borrador.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-07-listar-ofertas.md` y
`docs/05_modules/ofertas/casos-de-uso/UC-08-consultar-oferta.md`. Su columna «Criterio de aceptación (PRD)» de
«Trazabilidad» se rellena cuando el PRD esté aprobado.

Flujos de estos UC que **no** cubre esta HU: UC-02 · P, A1, E2; UC-05 · P, E2; UC-07 · P, A2, E4; UC-08 · P, E1
(HU-01). UC-04 · A1 (rechazo de las inscripciones activas, vía
`docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md`) lo cubre HU-05. UC-08 · P es de
HU-01, pero esta HU completa su conjunto de acciones por estado (RF-06, CA-23).

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | **Publicar.** «Publicar» en la ficha de un borrador. La API, dentro de una transacción (DEC-08), comprueba el estado: `draft` con título, descripción, ubicación y modalidad informados → `published` con la fecha de publicación del reloj inyectado (RN-02, RN-06, DEC-09); ya `published` → 200 sin cambios ni nueva fecha (RN-07, INV-08); `closed` → 409 (RN-06); faltan obligatorios → 400 con un elemento de `details` por campo pendiente y la oferta sigue en `draft` (RV-02). La banda salarial no es obligatoria (RV-01). La web muestra la lista de campos pendientes y, si publica, la ficha con la fecha de publicación en `dd/mm/aaaa` (Europe/Madrid). Ruta `POST /api/jobs/:id/publish` sin cuerpo (DT-03); 409 `INVALID_TRANSITION`, mensaje «Obligatorio para publicar.» en cada campo pendiente y orden de comprobación de DT-04. | Must | backend + frontend | - [ ] CA-01 a CA-04 |
| RF-02 | **Cerrar.** «Cerrar» en la ficha de una publicada abre un diálogo de confirmación con el número de inscripciones activas que se rechazarán (S-10), que hoy es siempre 0: lo da una lectura propia de la API, calculada por una dependencia inyectada que hoy devuelve 0 (DT-01). Al confirmar (`POST /api/jobs/:id/close`, DT-03), la API, en **una sola transacción**, comprueba el estado, pasa la oferta a `closed`, guarda la fecha de cierre e invoca el **punto de rechazo de inscripciones activas**, una dependencia inyectada que en esta HU no hace nada y que HU-05 conecta con UC-19 sin cambiar su firma (RN-08, DEC-06, DT-02). Ya `closed` → 200 sin cambios, sin tocar la fecha ni invocar el punto de rechazo (RN-07, S-01); `draft` → 409 (S-10); si falla cualquier paso, error en el envelope y la oferta sigue `published` sin fecha de cierre (S-10). Cancelar el diálogo no cambia nada. | Must | backend + frontend | - [ ] CA-05 a CA-09 |
| RF-03 | **Editar y borrar según el estado.** `service.update` y `service.remove` comprueban el estado dentro de la transacción, no solo la web (review de HU-01 §9, DEC-08): editar una `closed` → 409 (RV-04); borrar una `published` o `closed` → 409 (RV-06); editar una `published` exige que título, descripción, ubicación y modalidad sigan informados tras la fusión → 400 junto al campo (S-09); la edición de una publicada no cambia su estado ni sus fechas (UC-02 · P). La web no ofrece «Editar» en una cerrada ni «Borrar» fuera de `draft`, marca como obligatorios esos cuatro campos al editar una publicada y muestra el 409 si la oferta se cerró mientras se editaba. | Must | backend + frontend | - [ ] CA-10 a CA-13 |
| RF-04 | **Duplicar.** «Duplicar» en la ficha de una oferta en cualquier estado crea un borrador con su título (sin cambios), descripción, ubicación, modalidad y banda salarial, sin fechas de publicación ni de cierre, sin inscripciones, sin enlace a la original y con la fecha de creación del momento (RN-10, S-11). Respuesta 201 con la oferta nueva (DEC-07) y la web abre su ficha; la original no cambia. Una oferta inexistente → 404. | Must | backend + frontend | - [ ] CA-14, CA-15 |
| RF-05 | **Listado con filtros y paginación.** `GET /api/jobs` admite `status` (`draft`, `published` o `closed`), `q` (texto contenido en el título, sin distinguir mayúsculas ni tildes, ≤ 100 caracteres y sin caracteres de control), `page` (desde 1) y `pageSize` (1-100, por defecto 20), combinados en Y, con el orden y la forma de HU-01 y `total` del resultado filtrado (RN-11, RV-08, S-03, S-04, DEC-10, DEC-11.2). Cualquier otro parámetro sigue dando 400 (DEC-07). Reglas finas de los parámetros en DT-05. **La búsqueda normaliza con NFD y quita las marcas combinantes en los dos lados, así que «n» encuentra «ñ»** (`q=Pena` encuentra «Peña»): consecuencia aceptada de S-04 y DEC-10, fijada por un test (EC-48). La web ofrece el filtro por estado, la búsqueda (al enviar), la paginación y un selector «Por página» con 20, 50 y 100 (20 por defecto), con los filtros en la URL (DT-06, DT-07), y sustituye el aviso «Se muestran las 20 más recientes de N». | Must | backend + frontend | - [ ] CA-16 a CA-21<br>- [ ] EC-48 con su test |
| RF-06 | **Ficha por estado.** La ficha muestra las fechas de creación, publicación y cierre que tenga, en `dd/mm/aaaa` (Europe/Madrid), y solo las acciones que permite el estado (UC-08 · P, A1): `draft` → «Editar», «Publicar», «Borrar» y «Duplicar»; `published` → «Editar», «Cerrar» y «Duplicar»; `closed` → solo lectura con su fecha de cierre y solo «Duplicar». Las acciones se deshabilitan mientras su petición está en curso; «Publicar» y «Duplicar» no piden confirmación y el cierre usa el diálogo de RF-02. Textos, avisos y recarga tras un 409: DT-08. | Must | frontend | - [ ] CA-22, CA-23 |
| RF-07 | **Seed hasta 10 ofertas.** `npm run db:reset` añade a los 4 borradores de HU-01 **6 ofertas inventadas: 4 `published` y 2 `closed`** (DT-01 de HU-01, RV-26), todas con los campos de RN-02 válidos, fecha de publicación posterior a la de creación y, en las cerradas, fecha de cierre posterior a la de publicación. | Should | backend | - [ ] CA-24 |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Lecturas de la API | Rendimiento | `GET /api/jobs` (con cualquier combinación de `status`, `q`, `page` y `pageSize=100`), `GET /api/jobs/:id` y la lectura del número de inscripciones activas (DT-01) < 200 ms por petición con 100 ofertas en la base, con `fastify.inject` en local (mismo umbral que RNF-01 de HU-01 y QUALITY-GATES §2) |
| RNF-02 | Acciones de la API | Rendimiento | Publicar, cerrar, duplicar, `PATCH` y `DELETE` < 500 ms por petición con 100 ofertas en la base, con `fastify.inject` en local |
| RNF-03 | Errores sin detalles internos | Seguridad | 0 respuestas de error fuera del envelope `{ error: { code, message, details? } }` y 0 con *stack trace*, también en los 409 y en el 500 del cierre fallido |
| RNF-04 | Texto libre sin HTML interpretado | Seguridad | 0 elementos HTML creados a partir del título o la descripción en el listado filtrado, la ficha, el diálogo de cierre y el valor de la búsqueda |
| RNF-05 | Accesibilidad | Accesibilidad | 100 % de los controles nuevos (filtro de estado, búsqueda, tamaño de página, paginación, «Publicar», «Cerrar», «Duplicar») localizables por rol y nombre en Testing Library; el diálogo de cierre con el foco inicial en «Cancelar» y cerrable con Escape; avisos con `role="status"` y errores con `role="alert"` |
| RNF-06 | La búsqueda no llega a los logs | Privacidad | 0 apariciones del valor de `q` en las líneas de log de una petición `GET /api/jobs?q=…` (el logger solo registra la ruta sin query string, `apps/api/src/logger.ts:11`) |

## Modelo de datos
- **Sin migración nueva prevista.** `job_openings` ya tiene `status`, `published_at` y `closed_at` y los `CHECK` que
  defienden INV-01, INV-04 e INV-05 en lo que toca a las fechas
  (`apps/api/src/db/migrations/001-create-job-openings.sql:15-18`). Si el diseño necesita algo más para la búsqueda
  sin tildes (p. ej., una columna normalizada), va en una migración nueva `002-<descripción>.sql` (nueva; DEC-03:
  nunca se edita la 001).
- **No están en la base y los comprueba el servicio** dentro de la transacción (DEC-08): las transiciones permitidas
  (RN-06), «solo se borra un `draft`» (INV-03) y «una `closed` no se edita» (INV-02).
- `published_at` y `closed_at` los pone el sistema en UTC con el reloj inyectado y no cambian al repetir la transición
  (INV-08, DEC-09).
- **Datos personales:** ninguno.

## Interfaces / endpoints / pantallas

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/jobs/:id/publish` (DT-03) | Nuevo | Publica, sin cuerpo · 200 `Job` (también al repetir) · 400 `VALIDATION_ERROR` (ID, cuerpo o campos pendientes) · 404 · 409 `INVALID_TRANSITION` |
| POST | `/api/jobs/:id/close` (DT-03) | Nuevo | Cierra en una transacción, sin cuerpo · 200 `Job` (también al repetir) · 400 (ID o cuerpo) · 404 · 409 `INVALID_TRANSITION` · 500 `INTERNAL_ERROR` |
| GET | Número de inscripciones activas de una oferta (p. ej. `/api/jobs/:id/close-preview` → `{ activeApplications: 0 }`; nombre exacto en el diseño, DT-01) | Nuevo | 200 con un número (hoy 0) · 400 · 404; el contrato `Job` no cambia |
| POST | `/api/jobs/:id/duplicate` (DT-03) | Nuevo | Duplica, sin cuerpo · 201 `Job` nuevo en `draft` · 400 (ID o cuerpo) · 404 |
| GET | `/api/jobs` | Modificar | Admite `status`, `q`, `page` y `pageSize` (DEC-10); cualquier otro parámetro, 400 |
| PATCH | `/api/jobs/:id` | Modificar | 409 `INVALID_TRANSITION` si la oferta está `closed`; 400 si deja sin valor un obligatorio de una `published` |
| DELETE | `/api/jobs/:id` | Modificar | 409 `INVALID_TRANSITION` si la oferta no está en `draft` |
| GET | `/api/jobs/:id` | Sin cambios | Ya devuelve `status`, `publishedAt` y `closedAt` |
| Pantalla | Listado de ofertas (`/jobs`) | Modificar | Filtro por estado, búsqueda por título al enviar, paginación en un `<nav>` y selector «Por página» (20, 50, 100); filtros y página en la URL (`/jobs?status=…&q=…&page=…&pageSize=…`) (DT-06, DT-07) |
| Pantalla | Ficha de oferta (`/jobs/:id`) | Modificar | Fechas de publicación y cierre; acciones por estado (RF-06); solo lectura si `closed` |
| Pantalla | Diálogo de cierre | Nueva | Sobre `ConfirmDialog` (`apps/web/src/components/ConfirmDialog.tsx`), con el número de inscripciones activas |
| Pantalla | Formulario de edición (`/jobs/:id/edit`) | Modificar | Obligatorios marcados si la oferta está `published`; muestra el 409 si se cerró entre medias |

## Flujos de usuario
1. **Publicar:** ficha de un borrador → «Publicar» → ficha de la oferta publicada, con su fecha de publicación. Si
   faltan campos, la ficha muestra cuáles y la oferta sigue en borrador.
2. **Cerrar:** ficha de una publicada → «Cerrar» → diálogo con el número de inscripciones activas → «Cerrar oferta»
   (confirmar) → ficha en solo lectura con la fecha de cierre. «Cancelar» o Escape vuelven a la ficha sin cambios.
3. **Duplicar:** ficha de cualquier oferta → «Duplicar» → ficha del borrador nuevo.
4. **Editar una publicada:** ficha → «Editar» → formulario → «Guardar» → ficha. Si se vacía un obligatorio, error junto
   al campo; si la oferta se cerró en otra pestaña, mensaje de error sin guardar.
5. **Buscar:** listado → estado y/o texto → resultados desde la página 1 → «Siguiente»/«Anterior» o cambio de tamaño,
   conservando los filtros.

## Datos personales
No aplica — la oferta no contiene datos personales (FEAT-01, «Datos y conceptos clave»; `docs/RGPD.md` §1). El diálogo
de cierre muestra solo un **número** agregado de inscripciones, sin identificar a nadie, y en esta HU es siempre 0. El
rechazo de inscripciones y el recálculo de retención (datos del proceso de selección, `docs/RGPD.md` §1-3) llegan con
HU-05. Los logs siguen sin registrar cuerpos ni query strings (`apps/api/src/logger.ts:11`, RNF-06).

## Edge cases

Las 7 categorías de `docs/07_architecture_principles/QUALITY-GATES.md` §3, evaluadas por cada RF Must. RF-07 (Should)
no las exige.

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | Publicar `/api/jobs/abc` o con un cuerpo (`{ "status": "closed" }`) | 400 `VALIDATION_ERROR`; nada cambia (DT-03) |
| EC-02 | RF-01 | 1 Input inválido | Borrador con solo el título | 400 con `description`, `location` y `workMode` en `details` (no la banda); sigue en `draft` sin fecha de publicación |
| EC-03 | RF-01 | 2 Boundary | Borrador completo sin banda salarial; o con título de 120 y descripción de 5 000 caracteres | Se publica (la banda es opcional, RV-01) |
| EC-04 | RF-01 | 2 Boundary | Publicada con el reloj en 2026-10-06T22:30:00Z | La ficha muestra 07/10/2026 como fecha de publicación |
| EC-05 | RF-01 | 3 Fallo de dependencia | La escritura en SQLite falla al publicar | 500 `INTERNAL_ERROR` en el envelope; sigue en `draft` sin fecha de publicación; la web lo muestra con `role="alert"` y rehabilita «Publicar» |
| EC-06 | RF-01 | 4 Concurrencia | El borrador se borra en otra pestaña y después se publica | 404 `NOT_FOUND`; la web muestra el mensaje |
| EC-07 | RF-01 | 5 Datos corruptos | Una fila `published` sin `published_at` o sin descripción, insertada saltándose la API; o borradores creados con HU-01 | La base rechaza la primera por sus `CHECK` (migración 001, líneas 15-18); los borradores de HU-01 se publican sin migrar nada |
| EC-08 | RF-01 | 6 Seguridad | Publicar IDs secuenciales (enumeración) | Sin datos personales que exponer (DEC-04); el 404 no repite el ID ni datos de la oferta |
| EC-09 | RF-01 | 7 Idempotencia | Doble clic en «Publicar» | La web deshabilita el botón mientras envía; una segunda petición que llegue a la API da 200 con la misma fecha de publicación (CA-02, INV-08) |
| EC-10 | RF-02 | 1 Input inválido | Cerrar `/api/jobs/1.5` o con un cuerpo | 400 `VALIDATION_ERROR`; nada cambia |
| EC-11 | RF-02 | 2 Boundary | Cerrar una publicada sin inscripciones (el caso de toda esta HU); cierre a las 2026-10-06T22:30:00Z | El diálogo muestra 0 inscripciones activas; la ficha muestra 07/10/2026 como fecha de cierre |
| EC-12 | RF-02 | 3 Fallo de dependencia | Falla el punto de rechazo de inscripciones (inyectado en el test) o la escritura del estado | 500 `INTERNAL_ERROR`; la oferta sigue `published` y `closed_at` nulo (`ROLLBACK`, DEC-06); la web muestra el error y la ficha sigue como publicada |
| EC-13 | RF-02 | 4 Concurrencia | Con el diálogo abierto, otra pestaña cierra la oferta y después se confirma | 200 sin cambios con la fecha de cierre de la primera (A3) |
| EC-14 | RF-02 | 5 Datos corruptos | Ventana tolerada de INV-05 (entre los merges de HU-04 y HU-05): una oferta con inscripciones activas | Se cierra sin rechazarlas; limitación declarada en `hu.md`, no defecto de esta HU (la cierra HU-05) |
| EC-15 | RF-02 | 6 Seguridad | Título `<img src=x onerror=alert(1)>` en el diálogo de cierre (si lo nombra) | Se ve como texto (RNF-04); el error del cierre no lleva *stack trace* (RNF-03) |
| EC-16 | RF-02 | 7 Idempotencia | Doble clic en «Cerrar oferta» | La segunda petición da 200 sin cambiar la fecha de cierre y **sin invocar** otra vez el punto de rechazo (S-01: sin `StageChange`) |
| EC-17 | RF-03 | 1 Input inválido | `PATCH` de una publicada con `description: "   "`, `location: null` o `workMode: null` | 400 `VALIDATION_ERROR` en ese campo; la oferta no cambia (UC-02 · E3) |
| EC-18 | RF-03 | 1 Input inválido | `PATCH` de una cerrada con un título de 2 caracteres | 400 (el JSON Schema se comprueba antes que el estado; orden en DT-04); nada cambia |
| EC-19 | RF-03 | 2 Boundary | `PATCH` de una publicada que solo cambia o vacía la banda salarial | 200; el estado y `publishedAt` no cambian |
| EC-20 | RF-03 | 3 Fallo de dependencia | La escritura en SQLite falla al editar una publicada | 500 en el envelope; la oferta queda como estaba |
| EC-21 | RF-03 | 4 Concurrencia | Formulario abierto, otra pestaña cierra la oferta, se guarda (UC-02 · E4); o se borra un borrador que otra pestaña acaba de publicar | 409 `INVALID_TRANSITION` y nada cambia en los dos casos; si el borrado llega antes que la publicación, la publicación da 404 |
| EC-22 | RF-03 | 5 Datos corruptos | Una fila `published` sin modalidad, insertada saltándose la API | La base la rechaza por su `CHECK` (INV-04, migración 001, línea 18) |
| EC-23 | RF-03 | 6 Seguridad | `PATCH` de una publicada con `status: "draft"` o `publishedAt` (intento de despublicar o cambiar la fecha) | 400 `VALIDATION_ERROR` (S-03); nada cambia |
| EC-24 | RF-03 | 7 Idempotencia | Dos `DELETE` de una publicada; el mismo `PATCH` válido dos veces sobre una publicada | 409 las dos veces sin cambios; 200 las dos veces con el mismo resultado |
| EC-25 | RF-04 | 1 Input inválido | Duplicar `/api/jobs/abc` o un ID que no existe | 400 `VALIDATION_ERROR` · 404 `NOT_FOUND`; no se crea nada |
| EC-26 | RF-04 | 2 Boundary | Duplicar un borrador con solo el título; o una oferta con título de 120 caracteres | Borrador nuevo con solo el título; título idéntico, sin sufijo (S-11) |
| EC-27 | RF-04 | 3 Fallo de dependencia | La inserción en SQLite falla al duplicar | 500 en el envelope; no se crea ningún borrador; la original no cambia |
| EC-28 | RF-04 | 4 Concurrencia | La original se cierra en otra pestaña justo antes de duplicar | Se duplica igual (cualquier estado, S-11) |
| EC-29 | RF-04 | 5 Datos corruptos | — | N/A — la copia lee una fila que ya cumple los `CHECK` de la migración 001 y no hay datos anteriores al módulo |
| EC-30 | RF-04 | 6 Seguridad | Original con `<script>` en la descripción | La copia guarda el texto tal cual y la ficha lo muestra como texto (RNF-04); no se copian inscripciones (S-11) |
| EC-31 | RF-04 | 7 Idempotencia | Doble clic en «Duplicar» | La web deshabilita el botón; dos peticiones que lleguen a la API crean dos borradores (sin clave natural, como DT-03 de HU-01; DT-03) |
| EC-32 | RF-05 | 1 Input inválido | `page=0`, `page=-1`, `page=1.5`, `pageSize=0`, `pageSize=abc`, `status=Published`, `status` repetido, `sort=title` | 400 `VALIDATION_ERROR` con el parámetro en `details` |
| EC-33 | RF-05 | 1 Input inválido | `q` con un tabulador, un salto de línea o un NUL | 400 (S-03, DEC-11.8) |
| EC-34 | RF-05 | 2 Boundary | 20 y 21 resultados con `pageSize` 20; `pageSize` 1, 100 y 101; `q` de 100 y 101 caracteres tras recortar; página más allá de la última | Una página; dos páginas; válidos, válido y 400; 200 y 400; `items` vacío con el `total` real |
| EC-35 | RF-05 | 2 Boundary | `q` «gestion», «GESTIÓN» y «ano» con títulos «Responsable de gestión de nóminas» y «Becario/a de año en prácticas» | Las dos primeras encuentran la primera oferta; «ano» encuentra «año» (la ñ pierde la tilde con NFD, DEC-10); `q` vacío o solo espacios = sin filtro (DT-05) |
| EC-36 | RF-05 | 3 Fallo de dependencia | La API no responde al aplicar un filtro | Estado «error» con `role="alert"`; los controles conservan los valores elegidos |
| EC-37 | RF-05 | 4 Concurrencia | Se publica una oferta entre la petición de la página 1 y la de la 2 | Su fecha de referencia cambia y puede saltar o repetirse entre páginas; aceptado con paginación por desplazamiento (DEC-10 descarta el cursor) |
| EC-38 | RF-05 | 5 Datos corruptos | Título guardado en forma descompuesta (`Gestión`) | Lo encuentran «gestion» y «gestión» (la normalización se aplica a los dos lados) |
| EC-39 | RF-05 | 6 Seguridad | `q` = `' OR 1=1 --`, `%` o `_` | Texto literal con sentencias preparadas: 0 resultados salvo títulos que lo contengan; la tabla sigue intacta; `q` no aparece en los logs (RNF-06) |
| EC-40 | RF-05 | 7 Idempotencia | — | N/A — `GET` sin efectos: la misma consulta sin escrituras entre medias da el mismo resultado |
| EC-41 | RF-06 | 1 Input inválido | — | N/A — la ficha no recibe entrada del reclutador; el ID inválido ya lo cubre HU-01 (EC-43 de su PRD) |
| EC-42 | RF-06 | 2 Boundary | Ficha de una `closed` con creación 30/09, publicación 01/10 y cierre 06/10/2026 | Muestra las tres fechas en `dd/mm/aaaa`; una `draft` solo la de creación |
| EC-43 | RF-06 | 3 Fallo de dependencia | La API no responde al pulsar «Publicar», «Cerrar oferta» o «Duplicar» | Error con `role="alert"`; la ficha sigue con el estado anterior y el botón se rehabilita |
| EC-44 | RF-06 | 4 Concurrencia | Ficha de una publicada abierta en dos pestañas; una la cierra y la otra pulsa «Editar» → «Guardar» | 409 en la segunda; la web muestra el mensaje y vuelve a cargar la ficha, ya en solo lectura (DT-08) |
| EC-45 | RF-06 | 5 Datos corruptos | — | N/A — la base impone la coherencia estado-fechas (migración 001, líneas 15-17): no puede llegar una `closed` sin fecha de cierre |
| EC-46 | RF-06 | 6 Seguridad | Título con HTML en la ficha de una `closed` | Se ve como texto (RNF-04) |
| EC-47 | RF-06 | 7 Idempotencia | — | N/A — mostrar la ficha es un `GET`; la idempotencia de sus acciones está en EC-09, EC-16 y EC-31 |
| EC-48 | RF-05 | 2 Boundary | `q=Pena` con las ofertas «Monitor/a de la peña deportiva» y «Técnico/a de penalizaciones aduaneras» | Encuentra las dos: NFD sin marcas combinantes convierte «ñ» en «n» en los dos lados. Consecuencia **aceptada** de S-04 y DEC-10 (DT-05), fijada por un test de la API para que nadie la «arregle» sin una decisión nueva |
| EC-49 | RF-01, RF-02, RF-04 | 6 Seguridad | Una página de otro sitio lanza `POST /api/jobs/:id/close` (petición simple, sin *preflight*) contra la API local mientras el reclutador navega | 403 `CROSS_SITE_REQUEST` en el envelope y sin datos si `Sec-Fetch-Site` vale `cross-site`; nada cambia. Sin la cabecera (tests, clientes que no son navegador) pasa. Aplica a todas las escrituras (DEC-12, DT-09) |

## Decisiones aplicables
- **DEC-01** (stack y envelope): rutas nuevas con JSON Schema en Fastify y errores en
  `{ error: { code, message, details? } }` (RF-01 a RF-05, RNF-03).
- **DEC-03** (la `.db` no se versiona): sin migración prevista; si hace falta, la 002 nueva; seed inventado (RF-07).
- **DEC-04** (sin login, rol único): no hay permisos; seguridad centrada en inyección, HTML, enumeración y logs (EC-08,
  EC-39, RNF-06).
- **DEC-05** (dependencias): la normalización sin tildes no necesita dependencias (`String.prototype.normalize`); si el
  diseño añade alguna, la justifica en un `DEC-NN`.
- **DEC-06** (módulos): el cierre es una transacción con el punto de invocación de la operación interna de
  `inscripciones` (UC-19), que HU-05 conecta; `ofertas` no importa todavía `inscripciones` (RF-02, DT-01, DT-02).
- **DEC-07** (códigos HTTP): 200 transiciones y repeticiones, 201 duplicar, 400 validación y campos pendientes, 404,
  409 `INVALID_TRANSITION` para todo conflicto de estado (DT-04).
- **DEC-08** (concurrencia e idempotencia): las transiciones, la edición y el borrado comprueban el estado dentro de la
  transacción; la edición, última escritura; repetir una transición, 200 sin cambios (RF-01 a RF-03).
- **DEC-09** (fechas y reloj): `publishedAt` y `closedAt` con el reloj inyectado, mostradas en Europe/Madrid (EC-04,
  EC-11).
- **DEC-10** (listados): `page`, `pageSize` 1-100 (20 por defecto), forma `{ items, total, page, pageSize }`, búsqueda
  NFD sin diacríticos en el servidor, desempate por ID (RF-05).
- **DEC-11** (validación): `page` y `pageSize` como texto con `pattern` (punto 2), recorte (3), `details` por campo
  (4), `INTERNAL_ERROR` (5), reloj (6), `withTransaction` (7) y caracteres de control en `q` (8).
- **DEC-12** (escrituras desde otro sitio): 403 `CROSS_SITE_REQUEST` con `Sec-Fetch-Site: cross-site` en
  publicar, cerrar, duplicar y el resto de escrituras (EC-49, DT-09).

## Fuera de scope
- UC-04 · A1: rechazar las inscripciones activas al cerrar y el número real de inscripciones activas (HU-05, con
  UC-19); los puertos de DEC-06 (HU-04).
- Reabrir una oferta `closed` (se duplica, RV-03), despublicar (`published → draft`, RN-06) y el enlace entre una
  duplicada y su original (S-11).
- Filtrar por otros campos (ubicación, modalidad), buscar en la descripción u ordenar de otra forma (RV-08 no lo pide).
- Los flujos de HU-01 de estos UC (UC-02 · P, A1, E2; UC-05 · P, E2; UC-07 · P, A2, E4; UC-08 · P, E1), salvo el
  conjunto de acciones de la ficha (RF-06).
- La deuda abierta de HU-01: cabeceras de endurecimiento (SEC-01) y tope de `details` (SEC-04, antes de HU-03).
- Número de vacantes (RV-07), portales externos y login (DEC-04).

## Open Questions

No hay preguntas abiertas.

## Decisiones tomadas

Aprobadas por quien aprueba el PRD el 2026-10-06: OQ-01 a OQ-06 y OQ-08 (clase 1) según la recomendación de
ingeniería; OQ-07 (clase 2), por decisión de producto con la misma convención que el listado de candidatos.

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| DT-01 | (OQ-01) El número de inscripciones activas del diálogo de cierre lo expone la API en una lectura propia de la oferta (p. ej. `GET /api/jobs/:id/close-preview` → `{ activeApplications: 0 }`; nombre exacto en el diseño), calculada por una dependencia inyectada en el servicio que hoy devuelve 0 y que HU-05 sustituye por la operación de `inscripciones`. El contrato `Job` no cambia; la web lo pide al abrir el diálogo | Si la web pintara un 0 fijo, HU-05 tendría que tocar también la web; coherente con DEC-06 (dirección `ofertas → inscripciones`) | RF-02; RNF-01; endpoints; CA-05 | 2026-10-06 |
| DT-02 | (OQ-02) El cierre recibe por inyección una dependencia «rechazar inscripciones activas (oferta, fecha de cierre)» que en esta HU no hace nada; se llama dentro de `withTransaction`, después del `UPDATE`, solo en la transición real (no al repetir). El test de UC-04 · E2 inyecta una que lanza un error → 500 `INTERNAL_ERROR` y `ROLLBACK`. HU-05 cambia la implementación, no la firma | RN-08 y DEC-06 piden una sola transacción; sin inscripciones, la única forma realista de provocar el fallo de E2 es en ese punto | RF-02; EC-12, EC-16; CA-05, CA-07, CA-09; ventana de INV-05 | 2026-10-06 |
| DT-03 | (OQ-03) Rutas `POST /api/jobs/:id/publish`, `/close` y `/duplicate`, sin cuerpo (un cuerpo da 400; la web no envía `Content-Type`, como en el `DELETE` de HU-01). 200 con el `Job` al publicar y cerrar, también al repetir; 201 con el `Job` nuevo al duplicar. Duplicar no es idempotente: dos peticiones crean dos borradores | `status` es de solo lectura en el `PATCH` (S-03); códigos de DEC-07; sin clave natural no hay idempotencia (DT-03 de HU-01) | RF-01, RF-02, RF-04; endpoints; EC-01, EC-10, EC-31 | 2026-10-06 |
| DT-04 | (OQ-04) Un único código 409 `INVALID_TRANSITION` para publicar una `closed`, cerrar un `draft`, editar una `closed` y borrar una `published` o `closed`, con un mensaje por caso, sin `details` ni datos de la oferta. Campos pendientes al publicar: 400 `VALIDATION_ERROR` con `details` en el orden título, descripción, ubicación y modalidad, mensaje «Obligatorio para publicar.»; al vaciar uno de una publicada, «Obligatorio en una oferta publicada.». Orden: JSON Schema (400) → existencia (404) → estado (409) → reglas del servicio (400) | `technical.md` ya anticipa `INVALID_TRANSITION`; DEC-07 lo cita; DEC-11.4 fija la forma de `details` | RF-01, RF-03; EC-17, EC-18; CA-03, CA-04, CA-08, CA-10 a CA-13 | 2026-10-06 |
| DT-05 | (OQ-05) Parámetros del listado: `q` se recorta; vacío tras recortar = sin filtro; ≤ 100 puntos de código tras recortar; cualquier carácter C0 o DEL → 400 (también `\t` y `\n`); búsqueda literal (`%`, `_` y `\` no son comodines); NFD sin marcas combinantes y en minúsculas en los dos lados, **así que «n» encuentra «ñ» (`q=Pena` encuentra «Peña»), consecuencia aceptada de S-04, fijada por un test (EC-48)**. `status`: un solo valor. `page`: `^[1-9][0-9]{0,8}$` (el desplazamiento sigue siendo un entero seguro en JS); más allá de la última, `items` vacío con el `total` real. `pageSize`: `^[1-9][0-9]{0,2}$` y ≤ 100 | S-03, S-04, DEC-10 y DEC-11.2/.3/.8 fijan nombres, rangos y la normalización, pero no los bordes | RF-05; EC-32 a EC-35, EC-38, EC-39, EC-48; CA-16 a CA-21 | 2026-10-06 |
| DT-06 | (OQ-06) Listado en la web: filtros y página en la URL (`/jobs?status=…&q=…&page=…&pageSize=…`), para que «Atrás» y recargar los conserven; búsqueda al enviar (Enter o «Buscar»), no a cada tecla; cambiar un filtro o el tamaño vuelve a la página 1; «Anterior»/«Siguiente» y «Página X de Y» en un `<nav>` con nombre; sin resultados por filtro, «Ninguna oferta cumple los filtros.» con «Quitar filtros»; `q` validado también en el cliente (≤ 100) con el error junto al campo; una URL con parámetros inválidos muestra el `message` de la API con `role="alert"` y «Quitar filtros» | UC-07 · A1 y A3 no detallan la interfaz; diseño §2-§4 | RF-05; endpoints/pantallas; EC-36; CA-18 | 2026-10-06 |
| DT-07 | (OQ-07, producto) Selector «Por página» con 20, 50 y 100 (20 por defecto), con la misma convención que el listado de candidatos; los demás tamaños de 1-100, solo por la API o la URL | UC-07 · A3 pide que el reclutador elija el tamaño; la interfaz necesita valores concretos | RF-05; pantallas; CA-18 | 2026-10-06 |
| DT-08 | (OQ-08) Acciones en la web: «Publicar» y «Duplicar» sin confirmación. Diálogo de cierre sobre `ConfirmDialog` (como DT-02 de HU-01): título «¿Cerrar la oferta?», «Se rechazarán N inscripciones activas.» y «Una oferta cerrada no se puede reabrir: para volver a publicarla, duplícala.»; botones «Cancelar» (foco inicial) y «Cerrar oferta». Avisos con `role="status"`: «Oferta publicada.», «Oferta cerrada.», «Oferta duplicada.». Campos pendientes al publicar: «Para publicar falta: Descripción, Modalidad.» con `role="alert"` y enlace a «Editar». Tras un 409 en una acción o al guardar, se muestra el `message` y se vuelve a cargar la ficha | UC-03, UC-04 y UC-06 fijan los pasos, no los textos; RV-03 (`closed` es final) | RF-02, RF-03, RF-06; flujos de usuario; EC-44; CA-03, CA-05, CA-12 | 2026-10-06 |
| DT-09 | (Diseño, OD-01) Las escrituras con `Sec-Fetch-Site: cross-site` se rechazan con 403 `CROSS_SITE_REQUEST`; sin la cabecera se dejan pasar. Es DEC-12 | Publicar, cerrar y duplicar son `POST` sin cuerpo: peticiones simples que el navegador envía sin *preflight*, y la API no tiene login (DEC-04) | EC-49; Decisiones aplicables | 2026-10-06 |

## Criterios de aceptación

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-03 · P / RF-01, RF-06 | un borrador completo «Técnica/o de selección», híbrida, Valencia, 32 000-40 000 €/año, y el reloj en 2026-10-06T08:00:00Z | pulso «Publicar» | la API responde 200 con la oferta en `published` y `publishedAt` igual al reloj; veo su fecha de publicación 06/10/2026 y las acciones «Editar», «Cerrar» y «Duplicar» (ninguna otra) |
| CA-02 | UC-03 · A1 / RF-01 | una oferta publicada el 2026-10-06T08:00:00Z y el reloj una hora después | llega otra petición de publicarla | 200 sin cambios y `publishedAt` sigue siendo 2026-10-06T08:00:00.000Z |
| CA-03 | UC-03 · E1 / RF-01 | un borrador sin descripción ni modalidad | pulso «Publicar» | 400 `VALIDATION_ERROR` con `description` y `workMode` en `details`, veo en la ficha la lista de campos pendientes y la oferta sigue en `draft` sin fecha de publicación |
| CA-04 | UC-03 · E2 / RF-01 | una oferta `closed` | llega una petición de publicarla | 409 `INVALID_TRANSITION` y la oferta no cambia (estado y fechas iguales) |
| CA-05 | UC-04 · P / RF-02 | una oferta publicada, sin inscripciones, y el reloj en 2026-10-06T22:30:00Z | pulso «Cerrar», veo el diálogo con 0 inscripciones activas que se rechazarán y confirmo | la API cierra en una transacción: `closed`, `closedAt` igual al reloj y el punto de rechazo invocado una vez con esa oferta; veo la ficha en solo lectura con la fecha de cierre 07/10/2026 |
| CA-06 | UC-04 · A2 / RF-02 | una oferta publicada con el diálogo de cierre abierto | pulso «Cancelar» (o Escape) | no sale ninguna petición de cierre, sigue en `published` y sigo en su ficha |
| CA-07 | UC-04 · A3 / RF-02 | una oferta cerrada el 2026-10-06T22:30:00Z y el reloj una hora después | llega otra petición de cerrarla | 200 sin cambios, `closedAt` igual al primero y el punto de rechazo no se invoca |
| CA-08 | UC-04 · E1 / RF-02 | un borrador | llega una petición de cerrarlo | 409 `INVALID_TRANSITION` y sigue en `draft` |
| CA-09 | UC-04 · E2 / RF-02 | una oferta publicada y un punto de rechazo que falla (inyectado en el test) | se confirma el cierre | error en el envelope de DEC-01 sin *stack trace*; la oferta sigue en `published` con `closedAt` nulo; la web muestra el error y la ficha sigue como publicada |
| CA-10 | UC-02 · E1 / RF-03 | una oferta `closed` | abro su ficha; y llega a la API un `PATCH` válido sobre ella | la ficha no ofrece «Editar»; la API responde 409 `INVALID_TRANSITION` y nada cambia |
| CA-11 | UC-02 · E3 / RF-03 | una oferta publicada | vacío su descripción (o la dejo solo con espacios) y guardo | 400 `VALIDATION_ERROR` en `description`, veo el error junto al campo y la oferta no cambia |
| CA-12 | UC-02 · E4 / RF-03 | una oferta publicada con el formulario de edición abierto | otra pestaña la cierra y después guardo | 409 `INVALID_TRANSITION`, veo el mensaje y la oferta cerrada no cambia |
| CA-13 | UC-05 · E1 / RF-03 | una oferta publicada y otra cerrada | abro sus fichas; y llega a la API un `DELETE` de cada una | ninguna ficha ofrece «Borrar»; la API responde 409 `INVALID_TRANSITION` las dos veces y las dos siguen existiendo sin cambios |
| CA-14 | UC-06 · P / RF-04 | una oferta `closed` con todos los campos y el reloj en 2026-10-07T09:00:00Z | pulso «Duplicar» | 201 con un borrador nuevo (otro ID) con el mismo título, descripción, ubicación, modalidad y banda, `createdAt` igual al reloj, `publishedAt` y `closedAt` nulos; veo su ficha; la original no cambia |
| CA-15 | UC-06 · P / RF-04 | un borrador y una oferta publicada | duplico cada una | se crea un borrador nuevo por cada una con sus campos editables y sin fechas de publicación ni de cierre; las originales no cambian |
| CA-16 | UC-07 · A1 / RF-05 | «Responsable de gestión de nóminas» (`published`), «GESTIÓN de proveedores» (`published`), «Técnico/a de gestión administrativa» (`draft`), «Analista de datos junior» (`published`) y una `closed` con «Gestión» en el título | filtro por `published` y por «gestion» | veo solo las dos publicadas con «gestión» en el título, en el orden del listado, y `total` 2 |
| CA-17 | UC-07 · A3 / RF-05 | 25 ofertas | pido `page=2` con `pageSize` 20; y después `pageSize=100`, y `page=3` | la página 2 trae las 5 restantes en el mismo orden con `total` 25; `pageSize` 100 trae las 25; la página 3 trae `items` vacío con `total` 25; con exactamente 20 ofertas, `page=2` está vacía |
| CA-18 | UC-07 · A3 / RF-05 | el listado filtrado por `published` con 25 publicadas | paso a la página siguiente en la web y elijo 50 en «Por página» | veo la página 2 con el filtro conservado en la URL (`/jobs?status=published&page=2`); al elegir 50, vuelvo a la página 1 con las 25 y el mismo filtro; el selector ofrece solo 20, 50 y 100 |
| CA-19 | UC-07 · E1 / RF-05 | el listado | pido `pageSize=101` (o `0`) | 400 `VALIDATION_ERROR` con `pageSize` en `details` |
| CA-20 | UC-07 · E2 / RF-05 | el listado | busco un texto de 101 caracteres o uno con un carácter de control | 400 `VALIDATION_ERROR` con `q` en `details`; con 100 caracteres responde 200 |
| CA-21 | UC-07 · E3 / RF-05 | el listado | filtro por `status=archived` | 400 `VALIDATION_ERROR` con `status` en `details` |
| CA-22 | UC-08 · A1 / RF-06 | una oferta `closed` | abro su ficha | la veo en solo lectura, con sus fechas de creación, publicación y cierre en `dd/mm/aaaa`, y la única acción es «Duplicar» |
| CA-23 | UC-08 · P / RF-06 | un borrador | abro su ficha | veo solo su fecha de creación y las acciones «Editar», «Publicar», «Borrar» y «Duplicar» (ninguna otra) |
| CA-24 | RF-07 | una base recién regenerada con `npm run db:reset` | pido `GET /api/jobs` | `total` 10: 4 `draft`, 4 `published` y 2 `closed`; todas cumplen RN-02 a RN-04 y las fechas de publicación y cierre son posteriores a la de creación y a la de publicación, respectivamente |

## Contradicciones revisadas (paso 7)
Sin choques con `DECISIONS.md` ni con las «Decisiones tomadas» de HU-01. Dos evoluciones previstas que el diseño debe
recoger:
- **DT-04 de HU-01** («`GET /api/jobs` sin parámetros en esta HU») se supera aquí: el test EC-34 de
  `apps/api/test/jobs/list.test.ts:97` (`?page=2` → 400) cambia; un parámetro desconocido sigue dando 400.
- **CA-19 de HU-01** («Editar» y «Borrar», ninguna otra) se amplía con «Publicar» y «Duplicar» en `draft` (UC-08 · P;
  RF-06 de HU-01 ya decía «las acciones que existen en esta HU»): cambia el test de
  `apps/web/test/features/jobs/JobDetailScreen.test.tsx:69`.

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.

---
_v1.0 (2026-10-06): borrador con 8 Open Questions pendientes (7 de clase 1 y 1 de clase 2)._
_v1.1 (2026-10-06): OQ-01 a OQ-08 resueltas (DT-01 a DT-08), añadido EC-48 («n» encuentra «ñ», fijado por test) y
estado `Ready`, aprobado por quien aprueba el PRD._
_v1.2 (2026-10-06, diseño): añadidos EC-49 y DT-09 (DEC-12, 403 a escrituras desde otro sitio), aprobados con el diseño. El resto no cambia._
