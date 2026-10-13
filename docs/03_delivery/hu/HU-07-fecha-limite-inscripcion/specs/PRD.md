# HU-07 — Fecha límite de inscripción en una oferta — PRD

## Info
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** fullstack
- **Módulos:** `ofertas` (código `jobs`) e `inscripciones` (código `applications`)
- **Fecha:** 2026-10-13
- **Estado:** Ready

## Contexto

### Problema
Una oferta publicada acepta inscripciones hasta que el reclutador la cierra. Si quiere acotar de antemano hasta qué día
admite candidatos, hoy tiene que acordarse de cerrarla ese día (IDEA-004).

### Situación actual
- **API, ofertas.** `job_openings` (`apps/api/src/db/migrations/001-create-job-openings.sql`) no tiene fecha límite; sus
  fechas son instantes UTC. El repositorio fija sus columnas a mano (`apps/api/src/modules/jobs/repository.ts`). El
  esquema de la oferta es estricto (`apps/api/src/modules/jobs/schemas.ts`). Publicar comprueba los campos obligatorios
  con `missingRequiredDetails` (`apps/api/src/modules/jobs/rules.ts`) y da 400 con un elemento de `details` por campo.
  Duplicar copia solo los campos editables (`apps/api/src/modules/jobs/service.ts`).
- **API, inscripciones.** `assertCanEnroll` (`apps/api/src/modules/applications/service.ts`) comprueba oferta (404),
  candidato (404) y estado (409 `INVALID_TRANSITION`); el duplicado sale después, al insertar (409 `DUPLICATE`). La
  oferta se lee por el puerto `JobStatusPort` (`apps/api/src/modules/applications/ports.ts`), que hoy devuelve solo el
  estado y el título (DEC-06).
- **Día de Madrid.** Ya existe `madridCalendarDate` (`apps/api/src/modules/candidates/retention.ts`), pero en el
  módulo de candidatos: ofertas e inscripciones no pueden importarlo (`apps/api/test/module-boundaries.test.ts`).
- **Web.** El formulario de oferta (`apps/web/src/features/jobs/JobForm.tsx`, `job-form-model.ts`) solo tiene campos de
  texto, área y selección; los errores van junto al campo si el campo está en `FIELD_ORDER`. El pipeline
  (`apps/web/src/features/applications/PipelineScreen.tsx`) muestra «Inscribir candidato» solo si la oferta está
  `published` y recibe de la oferta solo `{ id, status }`. Un 409 al inscribir con un código desconocido acaba en la
  alerta del panel sin refrescar (`apps/web/src/features/applications/enroll-errors.ts`). Ya hay utilidades para pintar
  un día como `dd/mm/aaaa` (`apps/web/src/components/format.ts`).
- **Seed.** Las ofertas del seed tienen fechas fijas (`apps/api/src/db/seed.ts`).

### Resultado esperado
El reclutador pone, cambia o quita una fecha límite opcional en el formulario de la oferta. Hasta ese día incluido
(Europe/Madrid) se inscribe como hoy; desde el día siguiente la API responde 409 `ENROLLMENT_DEADLINE_PASSED` y el
pipeline no ofrece «Inscribir candidato» y explica por qué. La oferta no cambia de estado y sus inscripciones siguen
igual.

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-01 · P | Crear con fecha límite (o sin ella) | CA-01 |
| UC-01 · E7 | Fecha pasada o no válida al crear → 400 | CA-02 |
| UC-02 · P | Poner, ampliar, reducir o quitar el plazo | CA-03 |
| UC-02 · A2 | Plazo vencido sin tocar: se guarda sin error | CA-05 |
| UC-02 · A3 | Ampliar o quitar un plazo vencido reabre las inscripciones | CA-06 |
| UC-02 · E5 | Cambiar a una fecha pasada o no válida → 400 | CA-04 |
| UC-03 · E3 | Publicar con el plazo vencido → 400 | CA-07 |
| UC-06 · P | Duplicar no copia el plazo | CA-08 |
| UC-14 · P | Inscribir dentro del plazo (frontera del día) | CA-09 |
| UC-14 · E6 | Inscribir fuera de plazo → 409 y su precedencia | CA-10, CA-11 |
| UC-17 · A4 | Pipeline con el plazo vencido | CA-12 |

Ficheros: `docs/05_modules/ofertas/casos-de-uso/UC-01-crear-borrador.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-02-editar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-03-publicar-oferta.md`,
`docs/05_modules/ofertas/casos-de-uso/UC-06-duplicar-oferta.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md` y
`docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md`. CA-13 (seed) sale de FEAT-04 · R7.

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | **La fecha límite en la oferta.** Campo opcional de la oferta: un día de calendario (`AAAA-MM-DD`), sin hora; vacío o `null` = sin límite (FEAT-04 RN-01, RN-02). Se acepta en el alta y en la edición de `draft` y `published`; si cambia, no puede ser anterior a hoy en Europe/Madrid ni un día inexistente: 400 `VALIDATION_ERROR` junto al campo (RN-03, RN-05). Sin fecha máxima. Publicar un borrador con el plazo vencido da 400 con el campo en `details` y sigue en `draft` (RN-04). Duplicar no lo copia (RN-08). La oferta lo devuelve en su detalle. Migración nueva (DEC-03). | Must | backend | - [ ] CA-01 a CA-08 |
| RF-02 | **Inscribir fuera de plazo.** Al inscribir en una oferta `published` cuyo plazo terminó antes de hoy en Europe/Madrid (reloj inyectado, DEC-09), 409 `ENROLLMENT_DEADLINE_PASSED` con el mensaje «El plazo de inscripción de esta oferta terminó el dd/mm/aaaa.»; no se crea ni la inscripción ni el `StageChange` ni se recalcula la retención (RN-06). Orden: no publicada (409 `INVALID_TRANSITION`) > plazo vencido > duplicado (409 `DUPLICATE`) (RN-07). La fecha se lee dentro de la transacción de la inscripción por el puerto de la oferta (DEC-06, DEC-08). | Must | backend | - [ ] CA-09, CA-10, CA-11 |
| RF-03 | **Formulario.** Campo «Fecha límite de inscripción» (opcional, con `<label>`) en el alta y la edición; vaciarlo quita el plazo; el error de la API se muestra junto al campo (principio de diseño 4). | Must | frontend | - [ ] CA-01 a CA-06 (web) |
| RF-04 | **Pipeline.** En una oferta `published` con el plazo vencido, no se ofrece «Inscribir candidato» y se lee el texto de DT-01 con la fecha en `dd/mm/aaaa`, con inscripciones y sin ninguna; avanzar, rechazar y el historial siguen igual (RN-09, RN-10). Si se pulsa «Inscribir» con la página cargada antes del vencimiento, el 409 se muestra con `role="alert"` y el pipeline se refresca sin el botón. | Must | frontend | - [ ] CA-10 (web), CA-12 |
| RF-05 | **Seed.** Una oferta `published` con plazo futuro y otra con el plazo vencido, inventadas y relativas al día del `db:reset` (FEAT-04 R7). | Should | backend | - [ ] CA-13 |
| RF-06 | **Ficha de la oferta.** Muestra la fecha límite como dato, si existe, sin aviso de vencida (FEAT-04 R6: «como mucho el dato, si sale gratis»). | Could | frontend | - [ ] sin CA propio; lo decide `/tech-design` |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Frontera del día | Corrección | 100 % de estos casos en verde con el reloj inyectado: 23:59:59 y 00:00:00 de Europe/Madrid del día límite; un instante en que UTC y Madrid están en días distintos; los dos domingos de cambio de hora de 2026 (29/03 y 25/10) |
| RNF-02 | Accesibilidad | Accesibilidad | El campo nuevo, localizable por su `<label>` con Testing Library; el 409 y el texto del pipeline, anunciados con `role="alert"` o `role="status"`; 0 controles nuevos sin nombre accesible |

## Modelo de datos
- **`job_openings`** (dueño `ofertas`): columna nueva opcional con la fecha límite como día de calendario
  `AAAA-MM-DD` (como `retention_ends_at` de candidatos, DEC-09), con `CHECK` de formato. Migración `004-…` (nombre en
  `/tech-design`). Las ofertas existentes quedan sin plazo.
- **Datos personales:** ninguno.

## Interfaces / endpoints / pantallas
Errores en el envelope `{ error: { code, message, details? } }`.

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/jobs` | Modificar | Acepta la fecha límite opcional · 201 · 400 `VALIDATION_ERROR` junto al campo |
| PATCH | `/api/jobs/:id` | Modificar | Pone, cambia o quita (`null`) la fecha límite; solo se valida si cambia · 200 · 400 · 404 · 409 (cerrada, sin cambios) |
| POST | `/api/jobs/:id/publish` | Modificar | 400 con la fecha límite en `details` si ya venció |
| POST | `/api/jobs/:id/duplicate` | Modificar (comportamiento) | El borrador nuevo nace sin fecha límite |
| GET | `/api/jobs/:id` | Modificar | Devuelve la fecha límite (o `null`) |
| GET | `/api/jobs` | Sin cambios | Sin columna nueva (fuera de scope) |
| POST | `/api/applications` | Modificar | 409 `ENROLLMENT_DEADLINE_PASSED` (nuevo) |
| GET | Pipeline de una oferta | Modificar | Lleva lo necesario para saber si el plazo venció y su fecha (forma en `/tech-design`) |
| Interno | `JobStatusPort` | Modificar | Devuelve también la fecha límite (DEC-06) |
| Pantalla | Formulario de oferta (alta y edición) | Modificar | Campo «Fecha límite de inscripción» |
| Pantalla | Pipeline (`/jobs/:id/pipeline`) | Modificar | Sin «Inscribir candidato» y con el texto cuando el plazo venció |

El nombre del campo en la API lo fija `/tech-design` sin cambiar códigos ni comportamiento.

## Flujos de usuario
1. Nueva oferta → rellena la fecha límite → «Guardar» → borrador con plazo.
2. Editar una publicada → cambia o vacía la fecha → «Guardar».
3. Pipeline de una publicada con el plazo vencido → no hay «Inscribir candidato» y se explica por qué.
4. Pipeline abierto antes de medianoche → «Inscribir» después → alerta con el 409 → el pipeline se refresca sin botón.

## Datos personales
No aplica: la fecha límite es un dato de la oferta, no del candidato (FEAT-04 R7). El mensaje del 409 solo lleva la
fecha.

## Edge cases

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | `"2026-02-31"`, `"13/10/2026"`, `"2026-10-13T00:00:00Z"`, un número | 400 `VALIDATION_ERROR` junto al campo, sin repetir el valor (DEC-11.4) |
| EC-02 | RF-01 | 2 Boundary | Hoy; ayer; el 29/02 de un año bisiesto; dentro de 10 años | Hoy y futuras se guardan; ayer, 400 |
| EC-03 | RF-01 | 2 Boundary | Cadena vacía o solo espacios | Se guarda sin plazo (`null`, DEC-11.3) |
| EC-04 | RF-01 | 3 Fallo de dependencia | Falla la escritura al editar | 500 `INTERNAL_ERROR`; la oferta no cambia |
| EC-05 | RF-01 | 4 Concurrencia | Dos ediciones del plazo a la vez | Gana la última (S-02, DEC-08) |
| EC-06 | RF-01 | 5 Datos corruptos | Ofertas creadas antes de la migración | Sin plazo: se comportan como hoy |
| EC-07 | RF-01 | 6 Seguridad | Campo con `<script>` o SQL | 400 de formato; nunca se guarda |
| EC-08 | RF-01 | 7 Idempotencia | Reenviar la misma fecha ya vencida en una edición | 200 sin error por ella: no cambia (RN-03) |
| EC-09 | RF-01 | 2 Boundary | Editar una `closed` | 409 de HU-02, también si solo cambia la fecha (RV-04) |
| EC-10 | RF-02 | 1 Input inválido | — | N/A — inscribir no recibe la fecha: la lee de la oferta |
| EC-11 | RF-02 | 2 Boundary | Fecha límite hoy: 23:59:59 y 00:00:00 del día siguiente en Madrid; instante con UTC en otro día; cambios de hora | Dentro: se inscribe; fuera: 409 (RNF-01) |
| EC-12 | RF-02 | 3 Fallo de dependencia | Falla la escritura de la inscripción dentro de plazo | 500 sin nada a medias (como HU-04) |
| EC-13 | RF-02 | 4 Concurrencia | Se recorta el plazo a hoy mientras se inscribe | La inscripción usa el plazo vigente en su transacción (DEC-08) |
| EC-14 | RF-02 | 5 Datos corruptos | Oferta `published` sin plazo | Se inscribe como hoy |
| EC-15 | RF-02 | 6 Seguridad | Mensaje y `details` del 409 | Solo la fecha; sin datos del candidato |
| EC-16 | RF-02 | 7 Idempotencia | Reintentar la inscripción fuera de plazo | El mismo 409, sin crear nada |
| EC-17 | RF-03 | 1 Input inválido | El navegador no valida la fecha y llega un valor no válido | Error de la API junto al campo |
| EC-18 | RF-03 | 2 Boundary | Vaciar el campo en la edición | Se envía `null` y la oferta queda sin plazo |
| EC-19 | RF-03 | 3 Fallo de dependencia | La API no responde al guardar | Estado de error del formulario con lo escrito conservado (como hoy) |
| EC-20 | RF-03 | 4 Concurrencia | Doble clic en «Guardar» | Una sola petición (como hoy) |
| EC-21 | RF-03 | 5 Datos corruptos | Oferta sin plazo abierta en edición | Campo vacío |
| EC-22 | RF-03 | 6 Seguridad | — | N/A — el valor es una fecha; sin texto libre que pintar |
| EC-23 | RF-03 | 7 Idempotencia | Guardar sin cambiar nada | Como hoy; la fecha no se revalida |
| EC-24 | RF-04 | 1 Input inválido | — | N/A — el pipeline no recibe datos del reclutador |
| EC-25 | RF-04 | 2 Boundary | Plazo hoy (botón visible) y ayer (sin botón); pipeline vacío con el plazo vencido | Según RF-04, también en el vacío |
| EC-26 | RF-04 | 3 Fallo de dependencia | Falla el refresco tras el 409 | Se ve la alerta y el estado de error con reintento |
| EC-27 | RF-04 | 4 Concurrencia | Pipeline cargado antes de medianoche e «Inscribir» después | Alerta con el 409 y refresco sin botón |
| EC-28 | RF-04 | 5 Datos corruptos | Oferta `closed` con plazo vencido | Se ve como hoy una cerrada; el texto del plazo no sustituye al de cerrada |
| EC-29 | RF-04 | 6 Seguridad | — | N/A — solo se pinta una fecha con formato fijo |
| EC-30 | RF-04 | 7 Idempotencia | Recargar el pipeline con el plazo vencido | Mismo estado, sin botón |

## Decisiones aplicables
- **DEC-03:** la fecha límite entra con una migración nueva.
- **DEC-06:** `inscripciones` lee la fecha por el puerto de la oferta, sin importar el módulo; el día de Madrid no se
  importa de `candidatos` (`/tech-design` decide dónde vive el cálculo).
- **DEC-07 y DEC-11:** 400 junto al campo y sin repetir el valor; 409 con el código nuevo `ENROLLMENT_DEADLINE_PASSED`,
  que fija este PRD; esquema estricto y `null` para el opcional vacío.
- **DEC-08:** la fecha se lee dentro de la transacción de la inscripción; en las ediciones gana la última escritura.
- **DEC-09:** día de calendario de Europe/Madrid, reloj inyectado y `dd/mm/aaaa` en la web.

## Fuera de scope
- Columna en el listado de ofertas, aviso de plazo vencido en la ficha, filtros u orden por la fecha.
- Cierre automático, estado nuevo, avisos, hora de corte, límite por etapa, fecha de apertura, excepciones por
  candidato e historial del plazo (FEAT-04, «Alcance · Fuera»).
- Cambios en las inscripciones existentes, en avanzar, en rechazar o en el cierre de una oferta.

## Open Questions
No hay preguntas abiertas.

> Un PRD con Open Questions abiertas **no pasa** a diseño.

## Decisiones tomadas

| ID | Decisión | Razón | Impacto en el PRD | Fecha |
|----|----------|-------|-------------------|-------|
| DT-01 | (OQ-01) Textos → fecha pasada: «La fecha límite no puede ser anterior a hoy.»; fecha no válida: «Introduce una fecha válida.»; publicar con el plazo vencido: «La fecha límite de inscripción ya ha pasado.»; pipeline: «El plazo de inscripción terminó el dd/mm/aaaa: no se pueden inscribir más candidatos.» | Según la recomendación (la persona, 2026-10-13). FEAT-04 solo fija el texto del 409 | RF-01, RF-03, RF-04; CA-02, CA-04, CA-07 y CA-12 citan estos textos | 2026-10-13 |

## Criterios de aceptación
Reloj inyectado en 2026-10-13T10:00:00Z (12:00 en Madrid) salvo que se diga otra cosa (DEC-09). Datos inventados.

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-01 · P / RF-01, RF-03 | el formulario de nueva oferta | creo una con fecha límite 2026-10-13 (hoy), otra con 2036-10-13 y otra sin fecha | 201 las tres, en `draft`, con esa fecha o `null`; en la web el campo tiene su `<label>` y vacío no envía nada |
| CA-02 | UC-01 · E7 / RF-01, RF-03 | — | creo una con 2026-10-12 (ayer) y otra con `2026-02-31` | 400 `VALIDATION_ERROR` junto al campo con el texto de DT-01; no se crea nada |
| CA-03 | UC-02 · P / RF-01, RF-03 | una `published` con fecha límite 2026-10-20 | la cambio a 2026-10-15, a 2026-11-30 y la vacío | 200 cada vez, con esa fecha o `null`; el estado y las fechas de la oferta no cambian |
| CA-04 | UC-02 · E5 / RF-01, RF-03 | una `draft` con fecha límite 2026-10-20 | la cambio a 2026-10-12 y a `2026-13-01` | 400 junto al campo; la oferta queda como estaba |
| CA-05 | UC-02 · A2 / RF-01 | una `published` con fecha límite 2026-10-10 (vencida) | edito su descripción sin la fecha y, aparte, reenviando 2026-10-10 | 200 en los dos casos; ningún error por la fecha |
| CA-06 | UC-02 · A3 / RF-01, RF-02, RF-04 | una `published` con fecha límite 2026-10-10 | la amplío a 2026-10-13 y, en otra, la vacío | 200; sigue `published`; inscribir crea la inscripción y el pipeline vuelve a ofrecer «Inscribir candidato» |
| CA-07 | UC-03 · E3 / RF-01 | un borrador completo con fecha límite 2026-10-10 y otro con 2026-10-13 | los publico | el primero: 400 con la fecha límite en `details` y el texto de DT-01, sigue en `draft`; el segundo se publica |
| CA-08 | UC-06 · P / RF-01 | una oferta con fecha límite 2026-10-20 | la duplico | el borrador nuevo tiene la fecha límite `null`; la original no cambia |
| CA-09 | UC-14 · P / RF-02 | una `published` con fecha límite 2026-10-13 y otra sin plazo | inscribo con el reloj en 2026-10-13T21:59:59Z (23:59:59 en Madrid), y en la sin plazo | 201 en las dos; los casos de RNF-01 en verde |
| CA-10 | UC-14 · E6 / RF-02, RF-04 | la oferta de CA-09 | inscribo con el reloj en 2026-10-13T22:00:00Z (00:00:00 del 14 en Madrid) y lo reintento | 409 `ENROLLMENT_DEADLINE_PASSED` con «El plazo de inscripción de esta oferta terminó el 13/10/2026.» las dos veces; ni inscripción, ni `StageChange`, ni retención recalculada. En la web, con el pipeline cargado antes: el mensaje con `role="alert"` y el pipeline refrescado sin «Inscribir candidato» |
| CA-11 | UC-14 · E6 / RF-02 | una `published` con el plazo vencido y un candidato ya inscrito en ella; una `closed` con el plazo vencido | inscribo a ese candidato en la primera y a otro en la cerrada | 409 `ENROLLMENT_DEADLINE_PASSED` en la primera (no `DUPLICATE`) y 409 `INVALID_TRANSITION` en la cerrada |
| CA-12 | UC-17 · A4 / RF-04 | una `published` con el plazo vencido, con inscripciones, y otra igual sin ninguna | abro sus pipelines | sin «Inscribir candidato» y con el texto de DT-01 con la fecha en `dd/mm/aaaa`; en la primera, «Avanzar», «Rechazar» y el historial funcionan como antes |
| CA-13 | RF-05 | `npm run db:reset` | listo las ofertas publicadas | hay una con plazo futuro y otra con el plazo vencido, relativas al día del reset |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [x] 0 Open Questions.

---
_v1 (2026-10-13): borrador de `/prd-writer` con 1 Open Question de producto (OQ-01, textos). Estado: Draft._
_v1.1 (2026-10-13): Ready. OQ-01 respondida según la recomendación (DT-01) y validado por la persona._
