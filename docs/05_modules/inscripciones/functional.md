# Módulo `inscripciones` (código `applications`) — Funcional

Estado de `main` sincronizado hasta **HU-06** (2026-10-07). Lo mantiene `/module-sync`; la foto técnica está en
[technical.md](technical.md).

## Propósito

El reclutador une ofertas y candidatos: inscribe a un candidato en una oferta publicada desde su pipeline, ve en qué etapa
está cada uno y los mueve por las etapas hasta contratarlos o rechazarlos, con un historial que
nunca se reescribe. Es el corazón del ATS y gobierna la retención de los datos del candidato: mientras tenga una
inscripción abierta, su fecha de fin de retención no existe («mientras dure el proceso», RGPD §3). Nace con FEAT-03
(IDEA-003).

## Alcance objetivo

El de FEAT-03, en API y web: inscribir (UC-14), avanzar (UC-15) y rechazar (UC-16), el pipeline de una oferta, también
cerrada y en solo lectura (UC-17), el historial de cada inscripción (UC-18), el rechazo automático al cerrar una oferta
(UC-19), el puerto de procesos del candidato y el recálculo de su retención al crear y cerrar inscripciones. Fuera:
retroceder o deshacer un cambio, borrar inscripciones, editar el motivo o la nota de un rechazo, notas en los avances,
paginar el pipeline, inscribir desde la ficha del candidato o a varios a la vez, el estado «anonimizado» y su
bloqueo (feature A), la exportación de la ficha (RGPD §4), la importación CSV (feature C), los avisos al candidato y los
roles o login (DEC-04).

## Actores

Un único actor, el **reclutador**, sin login (DEC-04): dispara UC-14 a UC-18 y, de forma indirecta al cerrar una oferta
(UC-04), UC-19. El candidato es el interesado cuyos datos se tratan; no usa la aplicación. No hay procesos programados.

## Capacidades

Una por caso de uso del [catálogo del módulo](casos-de-uso/README.md). El estado sale de la review de cada HU.

| Capacidad | UC | Estado | HU | Qué hay hoy |
|---|---|---|---|---|
| Inscribir un candidato en una oferta | UC-14 | ✅ | HU-04 | Desde el pipeline de una oferta publicada, buscar por nombre o email (hasta 10) e inscribir de uno en uno; nace en «Recibida» con su primer cambio de etapa y la retención del candidato pasa a «mientras dure el proceso», todo o nada; borrador, cerrada, duplicado (en cualquier etapa), inexistente y fallo de escritura dan su error sin crear nada |
| Avanzar una inscripción a la etapa siguiente | UC-15 | ✅ | HU-05 | «Avanzar» en cada tarjeta no final lleva a la etapa siguiente; contratar pide confirmación, no toca la oferta ni las demás inscripciones y recalcula la retención; con la etapa esperada (si otra pestaña la movió, «ha cambiado de etapa» y nada cambia) y reintento sin escrituras; salto, retroceso, etapa final, inexistente y fallo de escritura dan su error sin cambiar nada |
| Rechazar una inscripción | UC-16 | ✅ | HU-05 | «Rechazar» abre un formulario con motivo de la lista y nota opcional (≤ 500 caracteres, con aviso de no escribir datos sensibles); recalcula la retención; el reintento conserva el motivo y la nota originales; la nota nunca sale en logs, errores ni pipeline |
| Ver el pipeline de una oferta | UC-17 | ✅ | HU-04, HU-05 | Seis columnas con nombre (enlazado al detalle), fecha del último cambio y motivo del rechazo, sin email, teléfono ni nota; «Avanzar» y «Rechazar» en las tarjetas no finales de una oferta publicada; una cerrada, desde su ficha y en solo lectura; vacío, error y «Página no encontrada». A3 («Candidato anonimizado») es de la feature A |
| Consultar el historial de una inscripción | UC-18 | ✅ | HU-05 | `/applications/:id` muestra candidato, oferta, etapa actual e historial del más antiguo al más reciente (fecha, origen, destino, motivo y nota); se llega desde cada tarjeta y desde el 409 por duplicado («Ver la inscripción»); inexistente → «Página no encontrada» |
| Rechazar las inscripciones activas al cerrar una oferta | UC-19 | ✅ | HU-06 | Al cerrar una oferta, sus inscripciones no finales pasan a «Rechazado» con el motivo «oferta cerrada», sin nota y con la fecha del cierre, en la misma transacción; las `hired` y `rejected` no cambian; la retención de cada candidato afectado se recalcula («cierre + 6 meses» si no le queda otro proceso abierto). El diálogo de cierre anuncia el número real. Sin activas, no escribe nada; un fallo deshace el cierre entero; tras el cierre, avanzar da «ha cambiado de etapa» y rechazar, 200 sin cambios |

## Alcance no implementado

- **Feature A:** el estado «anonimizado», su marca en el pipeline (UC-17 · A3, «Candidato anonimizado») y en avanzar,
  rechazar, el cierre de una oferta y el detalle, y el vaciado de la nota al anonimizar (la base ya lo permite; ver `docs/RGPD.md` §7).
- **Fuera de FEAT-03:** exportación de la ficha, importación CSV, inscribir desde la ficha del candidato o a varios a la
  vez, y paginar el pipeline.

## Reglas de negocio

Las de FEAT-03, con su estado real en `main`.

**Implementadas**
- **RN-01** — solo se inscribe en ofertas `published`; en `draft` o `closed`, 409 `INVALID_TRANSITION` y no se crea nada.
- **RN-02** — una sola inscripción por candidato y oferta, para siempre y en cualquier etapa: el índice único decide y el
  409 `DUPLICATE` lleva el ID de la existente.
- **RN-03** — toda inscripción nace en `received` con su `StageChange` sin origen → `received`, con el mismo instante.
- **RN-04** — solo se avanza a la etapa siguiente; `rejected` desde cualquier etapa no final; `hired` y `rejected` son
  finales. Lo decide el servicio (409 `INVALID_TRANSITION`) y lo defiende el `CHECK` de la base.
- **RN-05** — el rechazo lleva un motivo de la lista cerrada (`job_closed` no se puede elegir a mano) y una nota
  opcional de hasta 500 caracteres, con el aviso de no usarla para datos sensibles.
- **RN-06** — el cambio de etapa envía la etapa esperada; si no coincide, 409 `STAGE_MISMATCH` y nada cambia.
- **RN-07** — pedir la etapa actual (o rechazar una ya rechazada) da 200 sin `StageChange`; prevalece sobre RN-06
  (RV-23).
- **RN-08** — contratar no toca las demás inscripciones ni cierra la oferta; se admite más de un `hired`.
- **RN-09** — al cerrar una oferta, sus inscripciones no finales pasan a `rejected` con el motivo «oferta cerrada»
  (`job_closed`), sin nota y con la fecha del cierre, en la misma transacción del cierre. Es el único escritor de
  `job_closed`.
- **RN-10** — al crear una inscripción, al pasarla a una etapa final y al rechazarla por el cierre de su oferta,
  `candidatos` recalcula la retención en la misma transacción.
- **RN-11** — solo los rechazos llevan nota (INV-10); solo la escribe el rechazo manual y solo la lee el detalle.
- **RN-12** — el pipeline se ve también en ofertas cerradas, en solo lectura, con una columna por etapa ordenada por el último
  cambio (desempate por ID descendente), sin paginar, y solo con el nombre del candidato.
- **RN-13** — fechas en UTC y mostradas en Europe/Madrid como `dd/mm/aaaa`.

**Invariantes.** INV-01, INV-03, INV-04, INV-07, INV-08 e INV-10 los defiende la base (índice único, triggers, `CHECK` y
FK `RESTRICT`); INV-02, INV-06 e INV-09 los garantizan las transacciones de inscribir y de cambiar de etapa y los comprueba el seed (ver
[technical.md](technical.md)). **INV-05** (ninguna oferta cerrada con inscripciones no finales) se cumple **por
construcción** desde HU-06: el cierre rechaza las activas en su transacción y una oferta cerrada no admite inscripciones.
Lo fijan dos tests de invariante, sobre la base regenerada (CA-15) y tras cerrar por la API (CA-16). Avanzar y rechazar
siguen sin mirar el estado de la oferta (DT-09 de HU-05, mantenida por DT-01 de HU-06) como defensa en profundidad:
ese estado ya no se alcanza desde la API.

## Dependencias entre módulos

Dirección de las llamadas: `ofertas → inscripciones → candidatos` (DEC-06, aclarada en HU-04). Ningún módulo importa a otro:
los puertos se implementan por tipado estructural y se conectan en `apps/api/src/app.ts`.

- **Reales desde HU-04:**
  - `inscripciones` lee el estado de la oferta (y, desde HU-05, su título para el detalle, con `getJobSummary`) por
    `JobStatusPort`, que implementa `ofertas` (`apps/api/src/modules/jobs/job-status.ts`).
  - `inscripciones` lee la existencia y los nombres de los candidatos por `CandidateLookupPort`, que implementa
    `candidatos` (solo `id` y `full_name`).
  - `candidatos` lee los procesos del candidato por su `CandidateProcessesPort`, que implementa `inscripciones`
    (`apps/api/src/modules/applications/candidate-processes.ts`); `inscripciones` llama al recálculo de la retención
    de `candidatos` dentro de su transacción.
  - Las claves foráneas de `applications` a `candidates` y `job_openings` son integridad de la base, no acoplamiento: un
    candidato u oferta con inscripciones no se puede borrar.
  - En la web, `jobs` enlaza al pipeline (también de una oferta cerrada) y `applications` reutiliza el cliente de
    búsqueda de `candidates` y enlaza la oferta y el candidato desde el detalle.
- **Real desde HU-06:** `ofertas` cuenta y rechaza las inscripciones activas al cerrar por `JobApplicationsPort`, que
  define `ofertas` (`apps/api/src/modules/jobs/applications-port.ts`) e implementa `inscripciones`
  (`apps/api/src/modules/applications/job-closing.ts`), conectado en `composeServices` de `apps/api/src/app.ts`; el
  rechazo se une a la transacción del cierre y llama al recálculo de la retención de `candidatos`.

## Cuestiones abiertas

- **Tras el merge de HU-06, `npm run db:reset`** en cada portátil o base creada antes: una base de la ventana de INV-05
  (entre HU-04 y HU-06) puede tener ofertas cerradas con inscripciones abiertas.
- **Sin decidir en `docs/RGPD.md` §7, para la feature A** (seis cuestiones, de las reviews de HU-04, HU-05 y HU-06):
  retención vencida al inscribir, contratar, rechazar o cerrar la oferta; la marca de anonimizado en los puertos, en
  avanzar y rechazar, en el cierre y en el detalle; y el vaciado de la nota del rechazo. Desde HU-06, el cierre es un
  tercer camino, masivo, que agrava las cuestiones 2, 4 y 5.
- UC-17 · E1 y UC-18 · E1 dicen «estado de error» y la web muestra «Página no encontrada» (decisión del responsable
  técnico de no tocar los UC; reviews de HU-04, DD-02, y de HU-05, DD-06; DT-08 del PRD de HU-05).
- El pipeline no pagina (S-18, aceptado): RNF-01 se midió con 200 inscripciones en una oferta.
- Deuda de demo para `/audit-sprint`: integración en serie y e2e con *workers* acotados; *timeout* de los tests web
  justificado; medir la pasada completa en una máquina modesta (review de HU-04, §9.8).

## Estado vivo del MVP

- **% MVP:** 100 % — `round((6 + 0,5 · 0) / 6 · 100)`.
- **Conteo:** 6 ✅ / 0 🚧 / 0 ⬜ (6 capacidades).
- **Backlog:** ninguno de FEAT-03; quedan la feature A (anonimizado y RGPD §7) y lo que está fuera de FEAT-03.

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-07 | HU-04 | Nace el módulo: inscribir desde el pipeline (API y web), pipeline de una oferta con seis columnas, migración 003 con historial inmutable (salvo vaciar la nota), puerto de procesos real, seed de 40 inscripciones, y SEC-02 y «Ver pipeline» en `ofertas` | ~25 % |
| 2026-10-07 | HU-05 | Avanzar, contratar y rechazar (API y web) con etapa esperada y reintento, detalle de la inscripción con su historial, enlaces desde el pipeline y el 409 por duplicado, y pipeline de una oferta cerrada desde su ficha | ~83 % |
| 2026-10-07 | HU-06 | Rechazo de las inscripciones activas al cerrar una oferta (UC-19) en la transacción del cierre, con su recálculo de retención; `JobApplicationsPort` real, recuento real en el diálogo e INV-05 por construcción (CA-15, CA-16) | 100 % |
