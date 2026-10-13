# HU-07 — Anonimizar a petición — PRD

## Info
- **HU:** HU-07 · **Feature:** FEAT-04
- **Scope:** fullstack
- **Módulos:** `candidatos` (código `candidates`) e `inscripciones` (código `applications`)
- **Fecha:** 2026-10-13
- **Estado:** Draft (4 Open Questions de producto abiertas: OQ-01 a OQ-04)

## Contexto

### Problema
Cuando un candidato pide que se supriman sus datos (art. 17), el reclutador no tiene forma de atenderlo: el ATS no
borra candidatos ni sabe anonimizarlos, y borrar a mano rompería las inscripciones y las estadísticas de las ofertas
(RGPD §4 y §5, RV-16). Además, en cuanto exista un candidato sin nombre real, el detalle de sus inscripciones daría un
error interno (RGPD §7.5). Esta HU es la primera rebanada de FEAT-04 y tiene que ser vertical por eso (hu.md,
«Contexto»).

### Situación actual
- **API, candidatos.** La tabla `candidates` (`apps/api/src/db/migrations/002-create-candidates.sql`) guarda nombre
  (2-100 caracteres), email (único por `candidates_email_uq`, en minúsculas), teléfono, resumen, skills, las fechas y
  la versión del consentimiento y `retention_ends_at`. No hay ninguna marca de anonimizado ni ruta de borrado. Editar
  la ficha y registrar o retirar el consentimiento (`apps/api/src/modules/candidates/routes.ts`) solo comprueban que la
  ficha exista, y el listado y la búsqueda (`apps/api/src/modules/candidates/repository.ts`) filtran solo por texto y
  skill (RGPD §7.7). La retención la escribe solo `recalculateRetention` (`apps/api/src/modules/candidates/service.ts`).
- **API, inscripciones.** `stage_changes` (`apps/api/src/db/migrations/003-create-applications.sql`) admite los motivos
  `not_a_fit`, `candidate_withdrew`, `other` y `job_closed`; la nota (1-500 caracteres) solo va en rechazos, y los
  *triggers* hacen el historial inmutable salvo `SET note = NULL` (DT-12 de HU-04), pensado para esta feature. El
  rechazo en bloque ya existe para el cierre de una oferta (`apps/api/src/modules/applications/job-closing.ts`,
  `rejectActiveApplications`), filtrado por oferta. El detalle de una inscripción lanza un error interno si el puerto
  de candidatos no devuelve el nombre (`apps/api/src/modules/applications/service.ts:220`) y el pipeline omite esa fila
  en silencio (`apps/api/src/modules/applications/service.ts:82`).
- **Base.** `apps/api/src/db/connection.ts` abre la base en WAL y sin `secure_delete`: un `UPDATE` deja el dato
  anterior en páginas libres y en el `-wal` (RGPD §7.8).
- **Web.** La ficha (`apps/web/src/features/candidates/CandidateDetailScreen.tsx` y `CandidateDetails.tsx`) muestra
  «Mientras dure el proceso» cuando no hay fin de retención y ofrece «Editar» y la sección de consentimiento
  (`ConsentSection.tsx`). Existe un diálogo de confirmación reutilizable (`apps/web/src/components/ConfirmDialog.tsx`),
  con el foco inicial en «Cancelar», que ya usan la retirada del consentimiento y el cierre de una oferta. El pipeline
  (`apps/web/src/features/applications/PipelineBoard.tsx`) y el detalle (`ApplicationDetails.tsx`) pintan el nombre
  como texto; el motivo `candidate_withdrew` ya se rotula «Retirada del candidato»
  (`apps/web/src/features/applications/labels.ts`).

### Resultado esperado
Desde la ficha, el reclutador pulsa «Anonimizar», confirma en un diálogo que avisa de que es irreversible y de cuántas
inscripciones activas se rechazarán, y la ficha pasa a «Candidato anonimizado» con la fecha y el motivo «a petición».
En una sola transacción: datos identificativos sustituidos o vacíos, notas de rechazo vaciadas, inscripciones activas
rechazadas con «Retirada del candidato» y nada recuperable en los ficheros de la base. A partir de ahí el anonimizado
no se encuentra, no se edita, no se inscribe y aparece rotulado, sin errores, en el pipeline y en el detalle.

## Casos de uso

| UC · flujo | Descripción corta | CA |
|---|---|---|
| UC-20 · P | Anonimizar tras confirmar | CA-01, CA-02 |
| UC-20 · A1 | Ya anonimizado → 200 sin cambios | CA-03 |
| UC-20 · A2 | Con inscripciones activas → se rechazan | CA-04 |
| UC-20 · A3 | Cancelar el diálogo | CA-05 |
| UC-20 · E1 | Candidato inexistente → 404 | CA-06 |
| UC-20 · E2 | Petición mal formada → 400 | CA-07 |
| UC-20 · E3 | Falla una escritura → nada cambia | CA-08 |
| UC-20 · E4 | API no disponible desde la web | CA-09 |
| UC-20 · E5 | Escritura concurrente sobre el mismo candidato | CA-10 |
| UC-09 · E4 | Alta con un email del dominio reservado → 400 | CA-11 |
| UC-10 · E5 | Editar a un anonimizado → 409 | CA-12 |
| UC-10 · E6 | Edición con un email del dominio reservado → 400 | CA-11 |
| UC-11 · A5 | El anonimizado no aparece en listado ni búsqueda | CA-13 |
| UC-12 · A2 | Ficha de un anonimizado | CA-14 |
| UC-12 · A4 | «Anonimizar» en la ficha | CA-02 |
| UC-13 · E3 | Consentimiento de un anonimizado → 409 | CA-15 |
| UC-14 · E6 | Inscribir a un anonimizado → 409 | CA-16 |
| UC-15 · E7 | Avanzar una inscripción de un anonimizado → 409 | CA-17 |
| UC-16 · A2 | Rechazar una inscripción de un anonimizado | CA-17 |
| UC-17 · A3 | Pipeline con un anonimizado | CA-18 |
| UC-18 · A3 | Detalle e historial de un anonimizado | CA-19 |
| UC-19 · A3 | Cerrar una oferta con un anonimizado | CA-20 |

Ficheros: `docs/05_modules/candidatos/casos-de-uso/UC-20-anonimizar-a-peticion.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-09-alta-candidato.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-10-editar-ficha.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-11-buscar-candidatos.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-12-ver-ficha.md`,
`docs/05_modules/candidatos/casos-de-uso/UC-13-consentimiento.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-14-inscribir-candidato.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-15-avanzar-etapa.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-16-rechazar-inscripcion.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-17-ver-pipeline.md`,
`docs/05_modules/inscripciones/casos-de-uso/UC-18-consultar-historial.md` y
`docs/05_modules/inscripciones/casos-de-uso/UC-19-rechazo-al-cerrar-oferta.md`.

Además, CA-21 (sin residuos, FEAT-04 RN-21) y CA-22 (el anonimizado del seed, FEAT-04 Q31) salen de RF sin flujo
propio.

## Requisitos funcionales

| ID | Descripción | Prioridad | Scope | Criterios de aceptación |
|----|-------------|-----------|-------|-------------------------|
| RF-01 | **Anonimizar a petición.** Una acción de la API sin cuerpo anonimiza a un candidato y responde 200 con su ficha (como el consentimiento, HU-03). En una sola transacción (DEC-06, FEAT-04 RN-20): comprueba que existe y que no está anonimizado (DEC-08); el nombre pasa a «Candidato anonimizado»; el email, a uno generado a partir del ID en el dominio reservado `anonimizado.invalid`, único por construcción y sin derivar del original; teléfono y resumen quedan vacíos y skills, una lista vacía (FEAT-04 RN-02, RN-03); y registra la fecha (reloj inyectado, DEC-09) y el motivo «petición», sin guardar los datos borrados ni quién lo pidió (RN-06). Repetirla sobre un anonimizado responde 200 sin cambios (RN-10). | Must | backend | - [ ] CA-01, CA-03, CA-06, CA-07, CA-08, CA-10 |
| RF-02 | **Inscripciones y notas al anonimizar.** En la misma transacción de RF-01: cada inscripción del candidato en etapa no final pasa a `rejected` con el motivo `candidate_withdrew` («Retirada del candidato»), sin nota y con su `StageChange` fechado en la anonimización; se vacía la nota de todos sus rechazos anteriores; las inscripciones, sus etapas y el resto del historial se conservan (FEAT-04 RN-04, RN-08; INV-02, INV-03, INV-05; pendiente de OQ-01). | Must | backend | - [ ] CA-04, CA-08 |
| RF-03 | **Lo que se conserva y el fin de retención.** Se conservan el ID, la fecha de alta y las fechas y la versión del consentimiento (FEAT-04 RN-05; pendiente de OQ-02). El fin de retención queda vacío y ningún recálculo posterior lo cambia (RN-07). | Must | backend | - [ ] CA-01, CA-17, CA-20 |
| RF-04 | **Escrituras sobre un anonimizado y dominio reservado.** Editar la ficha, registrar o renovar el consentimiento, retirarlo e inscribir a un anonimizado responden 409 `CANDIDATE_ANONYMIZED` sin cambiar nada; el estado se comprueba dentro de la transacción de cada escritura (FEAT-04 RN-11, RN-20; DEC-07, DEC-08). El alta y la edición rechazan con 400 `VALIDATION_ERROR` en el campo `email` un email del dominio `anonimizado.invalid`, comparado tras normalizar (RN-03). Avanzar o rechazar una inscripción de un anonimizado sigue sus reglas actuales (todas están en etapa final) y no recalcula su retención. | Must | backend | - [ ] CA-11, CA-12, CA-15, CA-16, CA-17 |
| RF-05 | **Lecturas con un anonimizado.** El listado y la búsqueda (también el buscador del panel de inscribir del pipeline) lo excluyen siempre, también del `total`, sin filtro para verlo (FEAT-04 RN-12; INV-09). La ficha, el pipeline y el detalle de una inscripción responden 200 y lo muestran como «Candidato anonimizado», nunca 404, 410 ni un error interno (RN-13). La ficha devuelve además la fecha y el motivo de la anonimización. | Must | fullstack | - [ ] CA-13, CA-14, CA-18, CA-19 |
| RF-06 | **Pantalla.** En la ficha de un candidato no anonimizado, el botón «Anonimizar» abre el diálogo de confirmación (`ConfirmDialog`): avisa de que es irreversible y, si las hay, de cuántas inscripciones activas se rechazarán (FEAT-04 RN-09), con el número real leído de la API antes de abrirlo. Al confirmar, «Anonimizar» se deshabilita mientras se envía; con éxito, la ficha muestra «Candidato anonimizado», «Anonimizado el dd/mm/aaaa · a petición» y un mensaje de estado con `role="status"`; con error, un mensaje con `role="alert"` y se puede reintentar. La ficha de un anonimizado no ofrece «Editar», consentimiento ni «Anonimizar», y no muestra «Mientras dure el proceso». Ningún dato del candidato va a la URL, al título ni al almacenamiento del navegador (RNF-03 de HU-03). | Must | frontend | - [ ] CA-02, CA-05, CA-09, CA-14 |
| RF-07 | **Sin residuos.** Tras anonimizar, ni el fichero de la base ni sus ficheros auxiliares (`-wal`, `-shm`) contienen el nombre, el email, el teléfono, el resumen, las skills ni las notas de rechazo anteriores. El mecanismo lo decide `/tech-design` (FEAT-04 RN-21; INV-10; RGPD §7.8). | Must | backend | - [ ] CA-21 |
| RF-08 | **Datos de demostración.** El seed incluye un candidato inventado ya anonimizado a petición, con una inscripción rechazada con «Retirada del candidato» y sin nota (FEAT-04 Q31). Los dos vencidos del seed son de HU-08. | Should | backend | - [ ] CA-22 |

## Requisitos no funcionales

| ID | Descripción | Categoría | Métrica concreta |
|----|-------------|-----------|------------------|
| RNF-01 | Supresión irreversible en disco | Privacidad | 0 apariciones (búsqueda de bytes UTF-8) del nombre, el email, el teléfono, el resumen, cada skill y cada nota anteriores en `ats.db`, `ats.db-wal` y `ats.db-shm` justo después de la respuesta 200 (CA-21) |
| RNF-02 | Sin datos personales fuera de la ficha | Privacidad | 0 nombres, emails, teléfonos, resúmenes ni notas en los logs capturados, en los `message` y `details` de error y en las respuestas de 400, 404, 409 y 500 de las rutas de esta HU (RGPD §6.1) |
| RNF-03 | Atomicidad | Fiabilidad | 0 cambios (candidato, inscripciones, historial y notas idénticos byte a byte) tras un fallo inyectado en cualquier escritura de la anonimización (CA-08) |
| RNF-04 | Tiempo de respuesta | Rendimiento | La anonimización de un candidato con 10 inscripciones (5 activas) responde en < 1 s en local con la base del seed, medido en el test de CA-21 |
| RNF-05 | Accesibilidad | Accesibilidad | 100 % de los controles nuevos («Anonimizar», «Cancelar», «Anonimizar» del diálogo) localizables por rol y nombre; 100 % de los cambios de estado (enviando, anonimizado, error) anunciados con `role="status"` o `role="alert"`; foco inicial del diálogo en «Cancelar» |

## Modelo de datos
- **`candidates`** (dueño `candidatos`): marca de anonimizado con la fecha (instante UTC, DEC-09) y el motivo
  (`petición`; `vencimiento` llegará con HU-08, pendiente de OQ-03). Migración nueva (DEC-03); los candidatos
  existentes quedan sin marca. Los valores neutros caben en las restricciones actuales («Candidato anonimizado» tiene
  21 caracteres; el email generado, menos de 254). El nombre de las columnas y la forma de la guarda, en
  `/tech-design` (FEAT-04 Q21).
- **`applications` y `stage_changes`** (dueño `inscripciones`): sin columnas nuevas. Se usan el motivo
  `candidate_withdrew` y la única actualización que permiten los *triggers*, `SET note = NULL`.
- **Datos personales:** nombre, email, teléfono, resumen, skills y notas de rechazo se sustituyen o se vacían; fecha
  de alta y consentimiento se conservan (ver «Datos personales»).

## Interfaces / endpoints / pantallas
Errores en el envelope `{ error: { code, message, details? } }`.

| Tipo | Ruta o pantalla | Cambio | Descripción |
|------|-----------------|--------|-------------|
| POST | `/api/candidates/:id/anonymization` | Nuevo | Sin cuerpo. 200 con la ficha (también al repetir) · 400 `VALIDATION_ERROR` · 403 `CROSS_SITE_REQUEST` (DEC-12) · 404 `NOT_FOUND` · 500 `INTERNAL_ERROR` |
| GET | Número de inscripciones activas del candidato para el diálogo | Nuevo | `{ activeApplications }` · 200 · 400 · 404. Ruta y forma en `/tech-design`, como `close-preview` de HU-06 |
| GET | `/api/candidates/:id` | Modificar | Añade la fecha y el motivo de la anonimización (o vacío); `retentionEndsAt` vacío en un anonimizado |
| GET | `/api/candidates` | Modificar | Excluye a los anonimizados de `items` y de `total` |
| PATCH | `/api/candidates/:id` | Modificar | 409 `CANDIDATE_ANONYMIZED` sobre un anonimizado; 400 con un email de `anonimizado.invalid` |
| POST | `/api/candidates` | Modificar | 400 con un email de `anonimizado.invalid` |
| POST | `/api/candidates/:id/consent` · `/consent/withdrawal` | Modificar | 409 `CANDIDATE_ANONYMIZED` sobre un anonimizado, también sin consentimiento vigente |
| POST | `/api/applications` | Modificar | 409 `CANDIDATE_ANONYMIZED` si el candidato está anonimizado |
| GET | `/api/applications/:id` · `/api/jobs/:jobId/applications` | Modificar | 200 con «Candidato anonimizado»; nunca un error interno ni una fila omitida |
| Interno | Operación de `inscripciones` que rechaza las activas de un candidato y vacía sus notas | Nuevo | La pide `candidatos` dentro de su transacción (DEC-06); puerto y sentido en `/tech-design` |
| Pantalla | Ficha de candidato (`/candidates/:id`) | Modificar | Botón «Anonimizar» y diálogo; vista del anonimizado sin acciones |
| Pantalla | Pipeline y detalle de una inscripción | Modificar | «Candidato anonimizado» donde iba el nombre |

Las rutas exactas de la API las puede ajustar `/tech-design` sin cambiar códigos ni comportamiento.

## Flujos de usuario
1. Ficha → «Anonimizar» → diálogo («irreversible» y, si las hay, «Se rechazarán N inscripciones activas») →
   «Anonimizar» → la ficha pasa a «Candidato anonimizado · Anonimizado el dd/mm/aaaa · a petición», sin acciones, con
   el mensaje de estado.
2. Ficha → «Anonimizar» → «Cancelar» → la ficha sigue igual.
3. Ficha → «Anonimizar» → la API no responde → error con `role="alert"` en el diálogo → reintentar.
4. Pipeline de una oferta → tarjeta «Candidato anonimizado» → detalle con el historial sin notas → enlace a la ficha
   anonimizada.

## Datos personales
- **Qué:** sustituye nombre y apellidos, email, teléfono, resumen y skills, y vacía las notas de rechazo (RGPD §1 y
  §5). Conserva la fecha de alta y las fechas y la versión del consentimiento (FEAT-04 RN-05; pendiente de OQ-02).
  Registra solo la fecha y el motivo de la anonimización: ni los datos borrados ni quién o por qué canal la pidió
  (RN-06; minimización).
- **Para qué:** atender el derecho de supresión (art. 17, RGPD §4) sin romper las estadísticas de las ofertas.
- **Base jurídica y plazo:** tras anonimizar no queda ningún dato identificativo; lo que se conserva sin nombre ni
  email no identifica a nadie y prueba que el tratamiento previo tenía base (art. 7.1, RGPD §2).
- **Qué devuelve la respuesta:** la ficha ya anonimizada; los errores, sin ningún dato del candidato.
- **Qué no aparece nunca:** el dato anterior en logs, errores, respuestas o en los ficheros de la base (RF-07,
  RNF-01, RNF-02). Fixtures y tests con datos inventados (`@example.com`, `+34 600 000 0xx`; RGPD §6.3). Lo revisa el
  agente `datos-personales-auditor` en `/reviewer`.

## Edge cases

| ID | RF | Categoría | Situación | Comportamiento esperado |
|----|----|-----------|-----------|-------------------------|
| EC-01 | RF-01 | 1 Input inválido | ID `abc`, `0`, `-1` o `1.5` | 400 `VALIDATION_ERROR` en `id`; no cambia nada |
| EC-02 | RF-01 | 1 Input inválido | Cuerpo JSON con campos (`{"reason":"x"}`) o `text/plain` | 400; no cambia nada (S-03, DEC-11, DEC-12) |
| EC-03 | RF-01 | 2 Boundary | Candidato con todos los campos al máximo (nombre de 100, resumen largo, 20 skills) y otro con solo los obligatorios | Los dos quedan con los valores neutros y caben en las restricciones de la tabla |
| EC-04 | RF-01 | 3 Fallo de dependencia | Falla la escritura del candidato | 500 `INTERNAL_ERROR` sin datos; nada cambia (CA-08) |
| EC-05 | RF-01 | 4 Concurrencia | Doble clic: dos anonimizaciones a la vez | Las dos 200; una sola fecha de anonimización y un solo juego de `StageChange` (DEC-08) |
| EC-06 | RF-01 | 5 Datos corruptos | Candidato creado antes de la migración | Sin marca: se puede anonimizar con normalidad |
| EC-07 | RF-01 | 6 Seguridad | El ID existe o no | 404 con el mismo mensaje fijo, sin nombre ni email; el email generado no deriva del original (INV-08) |
| EC-08 | RF-01 | 6 Seguridad | La petición llega con `Sec-Fetch-Site: cross-site` | 403 `CROSS_SITE_REQUEST`; no cambia nada (DEC-12) |
| EC-09 | RF-01 | 7 Idempotencia | Anonimizar a un anonimizado | 200 con la misma ficha; ni la fecha ni el motivo cambian (RN-10, INV-04) |
| EC-10 | RF-02 | 1 Input inválido | — | N/A — la operación no recibe datos: se aplica al candidato del ID ya validado en RF-01 |
| EC-11 | RF-02 | 2 Boundary | 0 inscripciones; 1 activa; 3 activas, 1 `hired` y 2 `rejected` con nota | 0 y 1: lo esperado; con 3 activas, 3 `StageChange` nuevos, la `hired` sigue en `hired` y las dos notas quedan vacías |
| EC-12 | RF-02 | 3 Fallo de dependencia | Falla el `StageChange` de la segunda activa | Se deshace todo, también la primera y los datos del candidato (DEC-06, CA-08) |
| EC-13 | RF-02 | 4 Concurrencia | Una inscripción creada justo antes de anonimizar | Queda rechazada con «Retirada del candidato»; una creada después recibe 409 (UC-20 · E5) |
| EC-14 | RF-02 | 4 Concurrencia | Cerrar la oferta mientras se anonimiza a un candidato con una activa en ella | Las transacciones se serializan: la inscripción acaba con un único rechazo, el de la que llegó primero |
| EC-15 | RF-02 | 5 Datos corruptos | Un rechazo antiguo con nota y un rechazo `job_closed` sin nota | La nota queda vacía; el sin nota no se toca; ninguna fila del historial se borra (INV-05) |
| EC-16 | RF-02 | 6 Seguridad | Nota con el nombre del candidato y HTML | Vacía tras anonimizar; no vuelve a aparecer en el detalle (INV-02) |
| EC-17 | RF-02 | 7 Idempotencia | Repetir la anonimización | No crea más `StageChange` ni cambia fechas (DEC-08) |
| EC-18 | RF-03 | 1 Input inválido | — | N/A — no recibe datos: conserva o vacía campos ya guardados |
| EC-19 | RF-03 | 2 Boundary | Candidato sin consentimiento nunca; con consentimiento vigente; con consentimiento retirado | Las tres combinaciones de fechas y versión se conservan tal cual (pendiente de OQ-02) |
| EC-20 | RF-03 | 3 Fallo de dependencia | El puerto de procesos del candidato falla al recalcular | No se recalcula nada sobre un anonimizado: el fin de retención sigue vacío (RN-07) |
| EC-21 | RF-03 | 4 Concurrencia | Renovar el consentimiento a la vez que se anonimiza | El que llega después de la anonimización recibe 409; la retención queda vacía |
| EC-22 | RF-03 | 5 Datos corruptos | Un anonimizado al que un SQL manual le puso un fin de retención | La ficha de un anonimizado nunca muestra fin de retención ni «Mientras dure el proceso» |
| EC-23 | RF-03 | 6 Seguridad | — | N/A — conserva solo fechas y una versión de texto, que sin nombre ni email no identifican (RGPD §2) |
| EC-24 | RF-03 | 7 Idempotencia | Anonimizar dos veces | La fecha de alta y el consentimiento siguen idénticos |
| EC-25 | RF-04 | 1 Input inválido | Alta o edición con `x@anonimizado.invalid`, ` X@ANONIMIZADO.INVALID ` | 400 en `email` tras normalizar; no se guarda nada |
| EC-26 | RF-04 | 2 Boundary | Edición de un anonimizado sin ningún cambio real (mismo cuerpo) | 409: la guarda va antes de comparar valores |
| EC-27 | RF-04 | 3 Fallo de dependencia | — | N/A — la guarda es una lectura dentro de la transacción de cada escritura; su fallo es el de esa escritura, ya cubierto por sus PRD |
| EC-28 | RF-04 | 4 Concurrencia | Editar la ficha en otra pestaña justo después de anonimizar | 409; la ficha sigue anonimizada (UC-20 · E5) |
| EC-29 | RF-04 | 5 Datos corruptos | Un anonimizado con una inscripción activa (estado que INV-03 prohíbe) | Avanzarla o rechazarla no recalcula la retención del anonimizado |
| EC-30 | RF-04 | 6 Seguridad | Mensajes de los 409 y 400 | Sin datos del candidato ni el email recibido (DEC-11.4) |
| EC-31 | RF-04 | 7 Idempotencia | Retirar el consentimiento de un anonimizado sin consentimiento vigente | 409, no el 200 sin cambios de UC-13 · A3: prevalece la guarda (UC-13 · E3) |
| EC-32 | RF-05 | 1 Input inválido | Buscar `q=Candidato anonimizado` o `q=anonimizado.invalid` | 0 resultados de anonimizados |
| EC-33 | RF-05 | 2 Boundary | 21 candidatos, 1 de ellos anonimizado, `pageSize` 20 | `total` 20 y una sola página (DEC-10) |
| EC-34 | RF-05 | 3 Fallo de dependencia | La lectura de nombres por el puerto de candidatos falla (la base lanza un error) | 500 `INTERNAL_ERROR` en el envelope sin datos, como cualquier fallo de la base. Que el puerto no devuelva un candidato existente es inalcanzable por la clave foránea; un anonimizado sí lo devuelve, con el nombre «Candidato anonimizado» (RN-13, RGPD §7.5) |
| EC-35 | RF-05 | 4 Concurrencia | El pipeline abierto mientras se anonimiza a uno de sus candidatos | Al recargar, su tarjeta está en «Rechazado» con «Candidato anonimizado» |
| EC-36 | RF-05 | 5 Datos corruptos | Inscripción `hired` de un anonimizado | El pipeline y el detalle la muestran en «Contratado» con «Candidato anonimizado» |
| EC-37 | RF-05 | 6 Seguridad | Respuestas del pipeline y del detalle de un anonimizado | Sin email ni teléfono, anteriores ni generados (minimización, DEC-10) |
| EC-38 | RF-05 | 7 Idempotencia | — | N/A — solo lecturas |
| EC-39 | RF-06 | 1 Input inválido | — | N/A — la pantalla no tiene campos: un botón y un diálogo |
| EC-40 | RF-06 | 2 Boundary | 0, 1 y 2 inscripciones activas | 0: sin frase de inscripciones; 1: «Se rechazará 1 inscripción activa»; 2: «Se rechazarán 2 inscripciones activas» |
| EC-41 | RF-06 | 3 Fallo de dependencia | Falla la lectura del número de activas o la anonimización | Error con `role="alert"` y «Anonimizar» activo para reintentar; la ficha no cambia (UC-20 · E4) |
| EC-42 | RF-06 | 4 Concurrencia | Doble clic en «Anonimizar» del diálogo | Una sola petición: el botón se deshabilita al enviar |
| EC-43 | RF-06 | 5 Datos corruptos | La API devuelve una ficha anonimizada sin fecha | La web lo trata como respuesta inválida y muestra el error, no una ficha a medias |
| EC-44 | RF-06 | 6 Seguridad | Tras anonimizar | Ningún dato anterior queda en la URL, el título, `history.state` ni el almacenamiento; «Atrás» no muestra la ficha antigua |
| EC-45 | RF-06 | 7 Idempotencia | Reintentar tras un error de red cuando la API sí anonimizó | 200 por A1 y la ficha anonimizada |
| EC-46 | RF-07 | 1 Input inválido | — | N/A — no recibe datos |
| EC-47 | RF-07 | 2 Boundary | Nombre con «ñ» y tildes, emoji en el resumen | 0 apariciones de su codificación UTF-8 en los ficheros |
| EC-48 | RF-07 | 3 Fallo de dependencia | Falla el mecanismo de limpieza tras el `COMMIT` | Lo decide `/tech-design`; el test de CA-21 lo cubre |
| EC-49 | RF-07 | 4 Concurrencia | Otra conexión de lectura abierta durante la anonimización | Los ficheros siguen sin el dato tras la respuesta |
| EC-50 | RF-07 | 5 Datos corruptos | El dato anterior estaba ya en páginas libres por una edición previa | Tampoco aparece: se busca el valor anterior a cada edición del test |
| EC-51 | RF-07 | 6 Seguridad | Búsqueda de bytes en `ats.db`, `-wal` y `-shm` | 0 apariciones (RNF-01) |
| EC-52 | RF-07 | 7 Idempotencia | Anonimizar dos veces | Sigue sin residuos |

## Decisiones aplicables
- **DEC-03:** la marca de anonimizado va en una migración nueva; la base no se versiona.
- **DEC-04:** sin login; el reclutador registra la petición declarando que el candidato la hizo (FEAT-04 Q02).
- **DEC-06:** una sola transacción para candidato, inscripciones y notas; `inscripciones` expone la operación interna y
  `candidatos` la pide. Si el sentido del puerto pide aclarar DEC-06, lo hace `/tech-design`.
- **DEC-07 y DEC-11:** 400, 404 y 409 con el código `CANDIDATE_ANONYMIZED` que fija este PRD; 200 al repetir; mensajes
  sin el valor recibido.
- **DEC-08:** estado comprobado dentro de la transacción; repetir anonimizar es 200 sin cambios; unicidad del email
  generado por el índice `candidates_email_uq`.
- **DEC-09:** fecha de la anonimización con el reloj inyectado; la web la muestra en `dd/mm/aaaa` de Europe/Madrid.
- **DEC-10:** el listado excluye a los anonimizados también del `total`.
- **DEC-12:** la anonimización es un `POST` sin cuerpo: 403 desde otro sitio.

## Fuera de scope
- La pasada automática por vencimiento y el motivo «vencimiento» en acción (UC-21, HU-08).
- Los candidatos con la retención vencida pendientes de anonimizar: su marca en la ficha, su renovación y el 409 al
  inscribirlos (UC-12 · A3, UC-13 · A4 y UC-14 · E7, HU-09).
- La exportación por derecho de acceso (art. 15), la reversión, el borrado físico, un registro global de
  anonimizaciones, guardar quién o por qué canal pidió la supresión y un filtro para ver anonimizados (FEAT-04,
  «Alcance · Fuera»).
- El mecanismo concreto contra los residuos y la forma de la guarda de estado (`/tech-design`).

## Open Questions
OQ-01 a OQ-04 son las PA-01 a PA-04 de FEAT-04: el shaping las dejó con la recomendación aplicada y pendientes de la
persona responsable. Este PRD las recoge como suyas porque cambian criterios de esta HU (OQ-01, OQ-02) o el
vocabulario que comparte con HU-08 y HU-09 (OQ-03, OQ-04). **No pasa a diseño hasta que estén respondidas.**

| ID | Pregunta | Contexto | Recomendación | Decisión | Estado |
|----|----------|----------|---------------|----------|--------|
| OQ-01 | [Producto · PA-01] ¿Se puede anonimizar a petición a un candidato con inscripciones abiertas? | FEAT-04 RN-08, INV-03, Q03; afecta a RF-02, CA-04, CA-10, CA-17, CA-20, EC-11 a EC-14. Si fuera «no», UC-20 tendría una excepción nueva (409) y el art. 17 quedaría bloqueado mientras dure un proceso | Sí: en la misma transacción se rechazan sus activas con «Retirada del candidato», sin nota. Así avanzar, rechazar y cerrar la oferta nunca encuentran activas de un anonimizado | PENDIENTE | Abierta |
| OQ-02 | [Producto · PA-04] ¿Se conservan al anonimizar las fechas y la versión del consentimiento y la fecha de alta? | FEAT-04 RN-05, Q11; RGPD §7.9a; afecta a RF-03, CA-01, CA-14, EC-19. La alternativa es vaciarlas por minimización | Sí: sin nombre ni email no identifican a nadie y prueban el art. 7.1 | PENDIENTE | Abierta |
| OQ-03 | [Producto · PA-02] ¿Quién lanza la anonimización por vencimiento? | FEAT-04 RN-15, Q01. No cambia ningún CA de esta HU, pero fija si el motivo «vencimiento» existe y, con él, el modelo de datos y lo que muestra la ficha (UC-12 · A2) | Un proceso de la API, al arrancar y una vez al día, sin botón. El motivo admite «petición» y «vencimiento» desde esta HU | PENDIENTE | Abierta |
| OQ-04 | [Producto · PA-03] ¿Se puede inscribir a un candidato con la retención vencida aún no anonimizado? | FEAT-04 RN-18, Q22; RGPD §7.1. No cambia ningún CA de esta HU (es UC-14 · E7, de HU-09), pero decide si el 409 de inscribir tiene dos causas con códigos distintos | No: 409 «retención vencida» en HU-09, con un código propio distinto de `CANDIDATE_ANONYMIZED` | PENDIENTE | Abierta |

> Un PRD con Open Questions abiertas **no pasa** a diseño.

## Decisiones tomadas
_Ninguna todavía._

## Criterios de aceptación
Reloj inyectado en 2026-10-13T09:00:00Z salvo que se diga otra cosa (DEC-09). Todos los datos son inventados.

| ID | Origen (UC · flujo o RF) | Dado | Cuando | Entonces |
|----|--------------------------|------|--------|----------|
| CA-01 | UC-20 · P / RF-01, RF-03 | «Lucía Ferrer Prat», `lucia.ferrer@example.com`, `+34 600 000 012`, resumen y dos skills, dada de alta el 2026-09-01 con el consentimiento `v1` del 2026-09-01 y sin inscripciones | se anonimiza | 200 con la ficha: nombre «Candidato anonimizado», un email de `anonimizado.invalid` que no contiene `lucia` ni `ferrer`, teléfono y resumen vacíos, skills `[]`, anonimizada el 2026-10-13T09:00:00Z con motivo «petición», fin de retención vacío; la fecha de alta y las fechas y la versión del consentimiento no cambian |
| CA-02 | UC-20 · P, UC-12 · A4 / RF-06 | la ficha de un candidato no anonimizado sin inscripciones activas | pulso «Anonimizar» y confirmo | el diálogo dice que es irreversible y no menciona inscripciones; el foco empieza en «Cancelar»; al confirmar, «Anonimizar» queda deshabilitado; después la ficha muestra «Candidato anonimizado» y «Anonimizado el 13/10/2026 · a petición», un mensaje con `role="status"` y ningún botón «Editar», de consentimiento ni «Anonimizar» |
| CA-03 | UC-20 · A1 / RF-01 | el candidato de CA-01 ya anonimizado | se anonimiza otra vez con el reloj en 2026-10-14 | 200 con la misma ficha: la fecha sigue siendo 2026-10-13T09:00:00Z, el motivo «petición» y no se crea ningún `StageChange` |
| CA-04 | UC-20 · A2 / RF-02 | un candidato con 2 inscripciones activas (`received` y `interview`), 1 `rejected` con la nota «No encaja por horario» y 1 `hired` | se anonimiza | las 2 activas pasan a `rejected` con el motivo `candidate_withdrew`, sin nota y con un `StageChange` cada una fechado a las 2026-10-13T09:00:00Z; la nota del rechazo anterior queda vacía; la `hired` sigue en `hired`; ninguna inscripción ni `StageChange` se borra |
| CA-05 | UC-20 · A3 / RF-06 | la ficha de un candidato con 1 inscripción activa | pulso «Anonimizar», el diálogo dice «Se rechazará 1 inscripción activa» y pulso «Cancelar» | no se envía ninguna anonimización; la ficha y la inscripción no cambian |
| CA-06 | UC-20 · E1 / RF-01 | que no existe el candidato 9999 | se anonimiza | 404 `NOT_FOUND` con un mensaje sin datos personales; no cambia nada |
| CA-07 | UC-20 · E2 / RF-01 | un candidato existente | se anonimiza con el ID `abc` y, aparte, con el cuerpo `{"reason":"petición"}` | 400 `VALIDATION_ERROR` en los dos casos; el candidato no cambia |
| CA-08 | UC-20 · E3 / RF-01, RF-02 | el candidato de CA-04 y un fallo inyectado al escribir el segundo `StageChange` | se anonimiza | 500 `INTERNAL_ERROR` en el envelope sin datos personales; el candidato, sus 4 inscripciones, su historial y la nota quedan exactamente como estaban; sin el fallo, el reintento anonimiza una sola vez |
| CA-09 | UC-20 · E4 / RF-06 | que la API no responde | abro el diálogo y confirmo | veo un error con `role="alert"`; «Anonimizar» vuelve a estar activo; al reintentar con la API en marcha, la ficha queda anonimizada |
| CA-10 | UC-20 · E5 / RF-01, RF-02, RF-04 | un candidato no anonimizado | (a) se anonimiza dos veces a la vez; (b) se anonimiza y después llega una edición de su ficha; (c) se inscribe en una oferta publicada y, a continuación, se anonimiza | (a) las dos 200 con la misma fecha y un solo `StageChange` por activa; (b) la edición recibe 409 `CANDIDATE_ANONYMIZED`; (c) la inscripción acaba en `rejected` con `candidate_withdrew` |
| CA-11 | UC-09 · E4, UC-10 · E6 / RF-04 | — | se da de alta un candidato con ` X@ANONIMIZADO.INVALID ` y se edita otro para poner `y@anonimizado.invalid` | 400 `VALIDATION_ERROR` en `email`, sin el valor recibido en el mensaje; no se crea ni cambia nada |
| CA-12 | UC-10 · E5 / RF-04 | un candidato anonimizado | se edita su ficha con un nombre nuevo | 409 `CANDIDATE_ANONYMIZED`; la ficha no cambia |
| CA-13 | UC-11 · A5 / RF-05 | 3 candidatos, uno de ellos «Lucía Ferrer Prat» ya anonimizado | se lista sin filtros, se busca `q=Lucía`, `q=lucia.ferrer` y `q=anonimizado`, y se busca en el panel de inscribir del pipeline | el listado tiene 2 elementos y `total` 2; ninguna búsqueda devuelve al anonimizado |
| CA-14 | UC-12 · A2 / RF-05, RF-06 | un candidato anonimizado a petición el 2026-10-13 | abro su ficha por su ID | 200; veo «Candidato anonimizado», «Anonimizado el 13/10/2026 · a petición», la fecha de alta y el consentimiento en solo lectura; no veo fin de retención ni «Mientras dure el proceso», ni «Editar», ni acciones de consentimiento, ni «Anonimizar» |
| CA-15 | UC-13 · E3 / RF-04 | un anonimizado con el consentimiento vigente y otro sin consentimiento | se registra, se renueva y se retira el consentimiento de cada uno | 409 `CANDIDATE_ANONYMIZED` en todos los casos; fechas, versión y fin de retención no cambian |
| CA-16 | UC-14 · E6 / RF-04 | un anonimizado y una oferta publicada | se inscribe | 409 `CANDIDATE_ANONYMIZED` con un mensaje sin datos personales; no se crea ninguna inscripción ni se recalcula la retención |
| CA-17 | UC-15 · E7, UC-16 · A2 / RF-03, RF-04 | el candidato de CA-04 ya anonimizado | con la etapa esperada igual a la actual, se avanza una de sus inscripciones rechazadas, se rechaza otra rechazada y se rechaza la `hired` | 409 `INVALID_TRANSITION`, 200 sin cambios y 409 `INVALID_TRANSITION`; su fin de retención sigue vacío |
| CA-18 | UC-17 · A3 / RF-05 | una oferta con 3 inscripciones, una del anonimizado de CA-04 | abro el pipeline | 200 con las 3 tarjetas; la del anonimizado está en «Rechazado», muestra «Candidato anonimizado» y el motivo «Retirada del candidato», y abre su detalle |
| CA-19 | UC-18 · A3 / RF-05 | la inscripción rechazada con nota del anonimizado de CA-04 | abro su detalle | 200 con «Candidato anonimizado», la etapa y el historial con sus motivos y ninguna nota; el enlace al candidato abre su ficha anonimizada |
| CA-20 | UC-19 · A3 / RF-03 | una oferta publicada con una inscripción activa de otro candidato y una rechazada del anonimizado de CA-04 | se cierra la oferta | solo la del otro candidato pasa a `rejected` con `job_closed`; la del anonimizado no cambia y su fin de retención sigue vacío |
| CA-21 | RF-07 / FEAT-04 RN-21 | una base en fichero con «Lucía Ferrer Prat», `lucia.ferrer@example.com`, `+34 600 000 012`, el resumen «Resumen único de prueba», la skill `skill-unica-de-prueba` y un rechazo con la nota «Nota única de prueba» | se anonimiza y, tras la respuesta 200, se leen los bytes de `ats.db`, `ats.db-wal` y `ats.db-shm` | ninguno contiene ninguno de esos valores en UTF-8; la respuesta tarda < 1 s (RNF-04) |
| CA-22 | RF-08 / FEAT-04 Q31 | `npm run db:reset` | abro el listado, el pipeline de la oferta de la inscripción del anonimizado y su ficha | el listado no lo muestra; el pipeline enseña su tarjeta «Candidato anonimizado» en «Rechazado» con «Retirada del candidato»; su ficha está anonimizada a petición |

## Checklist de cierre
- [ ] Todos los RF tienen implementación verificable.
- [ ] Cada flujo de UC cubierto tiene al menos un CA, y cada CA su test.
- [ ] Cada edge case Must tiene su test.
- [ ] Review aprobada.
- [ ] 0 Open Questions.

---
_v1 (2026-10-13): borrador de `/prd-writer` con 4 Open Questions de producto (OQ-01 a OQ-04, las PA-01 a PA-04 de
FEAT-04), con la recomendación del shaping aplicada y pendientes de respuesta. Estado: Draft._
