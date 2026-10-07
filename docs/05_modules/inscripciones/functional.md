# Módulo `inscripciones` (código `applications`) — Funcional

Estado de `main` sincronizado hasta **HU-05** (2026-10-07). Lo mantiene `/module-sync`; la foto técnica está en
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
| Rechazar las inscripciones activas al cerrar una oferta | UC-19 | ⬜ | HU-06 | Latente: el cierre de una oferta sigue con el stub `noJobApplications`, que no rechaza nada |

## Alcance no implementado

- **HU-06:** el rechazo al cerrar una oferta (UC-19 y UC-04 · A1, que conecta `JobApplicationsPort` y cierra la ventana
  de INV-05). Salió de HU-05 por decisión del responsable del 2026-10-07.
- **Feature A:** el estado «anonimizado», su marca en el pipeline (UC-17 · A3, «Candidato anonimizado») y en avanzar,
  rechazar y el detalle, y el vaciado de la nota al anonimizar (la base ya lo permite; ver `docs/RGPD.md` §7).
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
- **RN-10** — al crear una inscripción y al pasarla a una etapa final, `candidatos` recalcula la retención en la misma
  transacción.
- **RN-11** — solo los rechazos llevan nota (INV-10); solo la escribe el rechazo manual y solo la lee el detalle.
- **RN-12** — el pipeline se ve también en ofertas cerradas, en solo lectura, con una columna por etapa ordenada por el último
  cambio (desempate por ID descendente), sin paginar, y solo con el nombre del candidato.
- **RN-13** — fechas en UTC y mostradas en Europe/Madrid como `dd/mm/aaaa`.

**Pendientes (HU-06)**
- **RN-09** — al cerrar una oferta, sus inscripciones no finales pasan a `rejected` con el motivo «oferta cerrada», en la
  misma transacción del cierre.

**Invariantes.** INV-01, INV-03, INV-04, INV-07, INV-08 e INV-10 los defiende la base (índice único, triggers, `CHECK` y
FK `RESTRICT`); INV-02, INV-06 e INV-09 los garantizan las transacciones de inscribir y de cambiar de etapa y los comprueba el seed (ver
[technical.md](technical.md)). **INV-05** (ninguna oferta cerrada con inscripciones no finales) **no se cumple todavía por
construcción**: ver «Cuestiones abiertas».

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
- **Latente:** `JobApplicationsPort` (`ofertas` hacia `inscripciones`: contar y rechazar las inscripciones activas al
  cerrar) sigue con el stub `noJobApplications` hasta HU-06.

## Cuestiones abiertas

- **Ventana de INV-05 hasta HU-06 (DT-10 de HU-04):** con el puerto en stub, cerrar una oferta deja abiertas sus
  inscripciones y la retención de sus candidatos en `null`; el diálogo de cierre dice 0 inscripciones activas. Y la API
  avanza o rechaza esas inscripciones (DT-09 de HU-05; la web no ofrece la acción). Aceptada: el seed la respeta y
  ningún test cierra ofertas con inscripciones. **HU-06 revisa DT-09 a propósito**; tras su merge, `npm run db:reset`.
- **Sin decidir en `docs/RGPD.md` §7, para la feature A** (seis cuestiones, de las reviews de HU-04 y HU-05): retención
  vencida al inscribir, contratar o rechazar; la marca de anonimizado en los puertos, en avanzar y rechazar y en el
  detalle; y el vaciado de la nota del rechazo.
- UC-17 · E1 y UC-18 · E1 dicen «estado de error» y la web muestra «Página no encontrada» (decisión del responsable
  técnico de no tocar los UC; reviews de HU-04, DD-02, y de HU-05, DD-06; DT-08 del PRD de HU-05).
- El pipeline no pagina (S-18, aceptado): RNF-01 se midió con 200 inscripciones en una oferta.
- Deuda de demo para `/audit-sprint`: integración en serie y e2e con *workers* acotados; *timeout* de los tests web
  justificado; medir la pasada completa en una máquina modesta (review de HU-04, §9.8).

## Estado vivo del MVP

- **% MVP:** ~83 % — `round((5 + 0,5 · 0) / 6 · 100)`.
- **Conteo:** 5 ✅ / 0 🚧 / 1 ⬜ (6 capacidades).
- **Backlog:** HU-06 (UC-19 y UC-04 · A1; conectar `JobApplicationsPort`, cerrar la ventana de INV-05 y revisar DT-09).

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-07 | HU-04 | Nace el módulo: inscribir desde el pipeline (API y web), pipeline de una oferta con seis columnas, migración 003 con historial inmutable (salvo vaciar la nota), puerto de procesos real, seed de 40 inscripciones, y SEC-02 y «Ver pipeline» en `ofertas` | ~25 % |
| 2026-10-07 | HU-05 | Avanzar, contratar y rechazar (API y web) con etapa esperada y reintento, detalle de la inscripción con su historial, enlaces desde el pipeline y el 409 por duplicado, y pipeline de una oferta cerrada desde su ficha | ~83 % |
