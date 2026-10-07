# RGPD en el ATS — EJEMPLO DIDÁCTICO

> **⚠️ EJEMPLO DIDÁCTICO.** Este documento es material del taller de SDD: describe cómo trataría un ATS **ficticio**
> los datos personales de sus candidatos, para que las features y los auditores tengan reglas concretas que cumplir.
> **No es asesoría jurídica** ni sustituye el análisis de un delegado de protección de datos. Los plazos y las bases
> jurídicas son supuestos razonables elegidos para el ejemplo. Todos los datos del repo son inventados.

Es la base de la **feature A (supresión y retención)** y la referencia del agente `datos-personales-auditor`.

## 1. Qué datos tratamos

| Dato | Entidad | ¿Necesario? | Para qué |
|---|---|---|---|
| Nombre y apellidos | `Candidate` | Sí | Identificar al candidato en el proceso |
| Email | `Candidate` | Sí | Contactar; detectar duplicados |
| Teléfono | `Candidate` | No (opcional) | Contactar si el candidato lo prefiere |
| Resumen profesional y skills | `Candidate` | Sí | Valorar la adecuación a una oferta |
| Consentimiento (fecha y alcance) | `Candidate` | Sí | Acreditar la base jurídica de la conservación |
| Fecha de fin de retención | `Candidate` | Sí | Saber cuándo hay que suprimir |
| Inscripciones y cambios de etapa | `Application`, `StageChange` | Sí | Seguir el proceso de selección |

**No se recogen**: fecha de nacimiento, foto, estado civil, nacionalidad, ni ningún dato de categoría especial (salud,
origen, religión, afiliación…). Un PRD que quiera añadir un dato nuevo tiene que justificar para qué lo necesita
(**minimización**) y la review lo comprueba.

## 2. Base jurídica (supuesto del ejemplo)

- **Proceso de selección en curso**: medidas precontractuales a petición del interesado (art. 6.1.b RGPD) mientras
  tenga alguna inscripción abierta.
- **Conservación para futuros procesos**: **consentimiento** explícito del candidato (art. 6.1.a), registrado con fecha
  y alcance. Sin consentimiento, al cerrarse su último proceso empieza a contar la retención corta.
- **Prueba del consentimiento (art. 7.1)**: la ficha guarda la fecha y la **versión** del texto (`v1`). El texto de cada
  versión `vN` se conserva en el repositorio (`apps/web/src/features/candidates/consent.ts` y su historial de git);
  cambiar el texto obliga a subir la versión, nunca a reescribir la anterior.

## 3. Retención

| Situación | Plazo de conservación (supuesto) | Al vencer |
|---|---|---|
| Con inscripción abierta | Mientras dure el proceso | — |
| Proceso cerrado, **sin** consentimiento para futuros procesos | 6 meses desde el cierre del último proceso | Anonimizar |
| Con consentimiento para futuros procesos | 24 meses desde la fecha del consentimiento | Anonimizar, salvo que lo renueve |
| **Sin** ninguna inscripción y **sin** consentimiento | 6 meses desde el alta | Anonimizar |

- `Candidate` guarda la **fecha de fin de retención**. Se recalcula al crear o cerrar una inscripción y al cambiar el
  consentimiento, en la misma transacción que la operación que lo provoca.
- **Fórmula única** (validada en el shaping, `S-06` de
  [reglas-validadas.md](02_discovery/reglas-validadas.md)): con alguna inscripción no final, **sin fecha de fin**; si
  no, la **más tardía** de las que apliquen: consentimiento vigente + 24 meses; cierre del último proceso + 6 meses;
  alta + 6 meses si nunca tuvo inscripciones. `hired` también cierra el proceso. Retirar el consentimiento aplica la
  fórmula aunque la fecha resultante ya haya pasado (se anonimiza en la siguiente pasada). Si la fecha no existe
  (31/08 + 6 meses), se toma el último día del mes.
- El vencimiento es **por día**: un candidato vence el mismo día de su fecha de fin de retención (caso límite típico).

## 4. Derechos del candidato

| Derecho | Qué hace el ATS |
|---|---|
| Acceso (art. 15) | El reclutador puede exportar la ficha completa del candidato con sus inscripciones e historial |
| Rectificación (art. 16) | Edición de la ficha |
| **Supresión (art. 17)** | **Anonimización a petición** (ver §5) |
| Retirada del consentimiento (art. 7.3) | Se retira el consentimiento y se recalcula la retención |

El derecho de oposición (art. 21) no aparece en la tabla porque solo cabe frente a tratamientos basados en interés
público o interés legítimo (art. 6.1.e y 6.1.f), y este ejemplo usa medidas precontractuales (6.1.b) y consentimiento
(6.1.a). Si una feature introdujera un tratamiento por interés legítimo, habría que añadirlo.

## 5. Supresión mediante anonimización

Suprimir no borra filas: **anonimiza** al candidato para no romper las estadísticas de las ofertas.

- Se sustituyen por valores neutros: nombre («Candidato anonimizado»), email, teléfono, resumen y skills.
- Se conservan: el ID, las inscripciones con su etapa y el historial de cambios de etapa, sin texto libre que pueda
  identificar a la persona.
- Queda registrado **cuándo** se anonimizó y **por qué** (petición o vencimiento), sin guardar los datos borrados.
- Es **irreversible** e **idempotente**: anonimizar dos veces no falla ni cambia nada.
- Un candidato anonimizado no aparece en búsquedas ni puede inscribirse en ofertas nuevas.

## 6. Reglas técnicas que vigila el auditor

1. **Nada de datos personales en logs, mensajes de error ni respuestas que no los necesitan.** Los logs de Fastify no
   registran cuerpos de petición, y el serializador de `apps/api/src/logger.ts` quita la query de la URL (`?q=` puede
   llevar un nombre o un email) y la IP de origen; lo comprueba `apps/api/test/logger.test.ts`.
2. **Minimización** en las respuestas: un listado devuelve lo justo para la lista, no la ficha entera.
3. **Seeds, fixtures y tests con datos inventados**; nunca CVs ni personas reales. Emails en `example.com` o
   `example.org`; teléfonos de ficción de la serie `+34 600 000 0xx`.
4. **Toda feature que toque datos de candidatos** declara en su PRD qué datos, para qué y cuánto tiempo.
5. **Exportaciones e importaciones** (CSV) validan y no dejan copias temporales con datos personales.

## 7. Cuestiones abiertas para la feature A (supresión y retención)

Salen de las reviews de HU-04 (`docs/03_delivery/hu/completadas/HU-04-inscribir-candidato/review/REVIEW.md` §4 y §9), de HU-05
(`docs/03_delivery/hu/completadas/HU-05-pipeline-etapas/review/REVIEW.md` §4 y §9) y de HU-06
(`docs/03_delivery/hu/completadas/HU-06-cerrar-oferta-inscripciones-activas/review/REVIEW.md` §4 y §9, que no añade cuestiones
nuevas pero agrava la 2, la 4 y la 5). Las 7, 8 y 9 salen de la auditoría del sprint-01
(`docs/10_audits/sprints/sprint-01-AUDIT.md` §3: D-02, D-01 y el inventario de datos personales, acción A-08). Se dejan
abiertas a propósito para el *shaping* de la feature A.

1. **¿Se puede inscribir, o encontrar en el buscador, a un candidato con la retención vencida que aún no se ha
   anonimizado?** Hoy sí: al inscribirlo su retención pasa a «mientras dure el proceso» (DT-06 del PRD de HU-04; lo fija
   `apps/api/test/applications/enroll-retention.test.ts`). La duda es si eso prolonga la conservación sin una base
   jurídica nueva, y si listados y búsquedas deben ocultar a los vencidos (§5 solo excluye a los anonimizados).
2. **Marca de anonimizado en los puertos.** Aún no existe ninguna columna ni estado de anonimizado. Cuando exista, los
   puertos que `inscripciones` usa para leer candidatos (`exists` y `findNames`) tendrán que rechazar o rotular a los
   anonimizados, y el pipeline mostrará «Candidato anonimizado». Desde HU-06, cerrar una oferta es un tercer camino,
   masivo, que tampoco consulta ninguna marca: rechaza todas las inscripciones activas de la oferta y recalcula la
   retención de sus candidatos (`apps/api/src/modules/applications/job-closing.ts`).
3. **¿La anonimización vacía siempre la nota libre del rechazo?** El historial es inmutable salvo `SET note = NULL`
   (DT-12 del PRD de HU-04, `apps/api/src/db/migrations/003-create-applications.sql`), pensado para esto. Falta decidir
   si se vacía en toda anonimización (por petición y por vencimiento).
4. **¿Contratar o rechazar a un candidato con la retención vencida prolonga la conservación?** Al pasar su última
   inscripción abierta a `hired` o `rejected`, la retención se recalcula a «cierre + 6 meses»
   (`apps/api/src/modules/applications/service.ts`, `applyStageChange`), aunque ya hubiera vencido. Es la misma duda
   que la 1, en la salida del proceso en vez de en la entrada. Desde HU-06, cerrar una oferta es un tercer camino,
   masivo, que la amplifica en volumen: un solo «Cerrar oferta» lleva a «cierre + 6 meses» a todos los candidatos de la
   oferta que se quedan sin procesos abiertos, también a los que tenían la retención vencida
   (`apps/api/src/modules/applications/job-closing.ts`; lo fija el test «EC-05 retención vencida simulada por SQL…» de
   `apps/api/test/applications/close-reject.test.ts`).
5. **Anonimizado en avanzar, rechazar, el cierre y el detalle.** Avanzar y rechazar no consultan ninguna marca de
   anonimizado, y el recálculo reescribiría la retención de un anonimizado, en contra de «irreversible e idempotente»
   (§5). Desde HU-06, cerrar una oferta es un tercer camino, masivo, con el mismo efecto sobre cada candidato de la
   oferta (`apps/api/src/modules/applications/job-closing.ts`). El detalle
   (`GET /api/applications/:id`) da **500** si `findNames` no devuelve el nombre del candidato. Hoy ese 500 es
   **inalcanzable**, porque la anonimización no existe y la clave foránea impide borrar al candidato. La feature A
   tiene que convertirlo en una respuesta decidida (por ejemplo, 404 o 410, o el detalle con «Candidato
   anonimizado»), no dejarlo como error interno.
6. **Texto libre en el historial.** La nota del rechazo (hasta 500 caracteres, solo con un aviso en la web) se guarda en
   un historial inmutable y sale tal cual en el detalle. Si la feature A no la vacía siempre (cuestión 3), el historial
   conserva texto libre que puede identificar a la persona, en contra de §5.
7. **Marca de anonimizado en las operaciones propias de `candidatos`.** Las cuestiones 2 y 5 cubren el lado de
   `inscripciones`; el de `candidatos` tampoco consulta ninguna marca (auditoría del sprint-01, D-02). En
   `apps/api/src/modules/candidates/service.ts`, editar la ficha (`PATCH /api/candidates/:id`, `updateCandidate`), dar
   el consentimiento (`POST /api/candidates/:id/consent`), retirarlo (`POST /api/candidates/:id/consent/withdrawal`)
   y `recalculateRetention` solo comprueban que la ficha exista; el listado y la búsqueda
   (`apps/api/src/modules/candidates/repository.ts`, `FILTER_SQL` de `listPage` y `count`) filtran solo por texto y
   skill. Falta decidir: (a) qué responde cada escritura sobre un anonimizado, **409** (conflicto de estado, DEC-07) o
   **410** (ya no existe como persona; sería un código nuevo que DEC-07 no recoge), o si alguna es un 200 sin cambios
   como las repeticiones idempotentes (DEC-08); (b) si la guarda va en el `WHERE` de cada `UPDATE` (p. ej.,
   `AND anonymized_at IS NULL`, como las guardas de estado de `jobs`) o en una comprobación previa en la transacción, y
   (c) si el `WHERE` del listado y de la búsqueda excluye a los anonimizados siempre o solo por defecto (§5 dice que
   «no aparece en búsquedas»).
8. **Residuos tras anonimizar.** `apps/api/src/db/connection.ts` abre la base con `PRAGMA journal_mode = WAL` y sin
   `secure_delete` (auditoría del sprint-01, D-01). Una anonimización por `UPDATE` dejaría el nombre, el email y el
   teléfono anteriores en páginas libres del fichero y en el `-wal` hasta el siguiente *checkpoint* o `VACUUM`, y §5
   pide una supresión irreversible. Hoy no hay riesgo porque la anonimización no existe. Falta decidir el mecanismo:
   ¿`PRAGMA secure_delete = ON` en la conexión (sobrescribe con ceros lo borrado, a cambio de más escrituras; con WAL,
   las copias del `-wal` siguen ahí hasta el *checkpoint*), o un `VACUUM` y un `wal_checkpoint(TRUNCATE)` tras cada
   anonimización o tras cada pasada por vencimiento? ¿Y cómo se prueba que el dato anterior ya no está en el fichero?
9. **Qué se conserva al anonimizar.** §5 enumera lo que se sustituye, pero no decide tres cosas (auditoría del
   sprint-01, inventario de datos personales de §3): (a) si se conservan las fechas y la versión del consentimiento
   (`consent_given_at`, `consent_version`, `consent_withdrawn_at`) y `created_at` como prueba del art. 7.1 (§2), o se
   vacían por minimización; (b) qué valor final queda en `retention_ends_at` (la fecha que venció, la de la
   anonimización o `NULL`) y que ningún recálculo posterior lo cambie (cuestión 5), y (c) cómo se genera el email
   anonimizado: el índice `candidates_email_uq` (`apps/api/src/db/migrations/002-create-candidates.sql`) obliga a que
   sea único, y no puede ser un *hash* reversible ni nada derivado del email original.
   Para guardar la marca hará falta una migración nueva con `anonymized_at` (DEC-03).
