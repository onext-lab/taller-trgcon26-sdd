# Módulo `inscripciones` (código `applications`) — Funcional

Estado de `main` sincronizado hasta **HU-04** (2026-10-07). Lo mantiene `/module-sync`; la foto técnica está en
[technical.md](technical.md).

## Propósito

El reclutador une ofertas y candidatos: inscribe a un candidato en una oferta publicada desde su pipeline, ve en qué etapa
está cada uno y, cuando llegue HU-05, los mueve por las etapas hasta contratarlos o rechazarlos, con un historial que
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
| Avanzar una inscripción a la etapa siguiente | UC-15 | ⬜ | HU-05 | La base ya solo admite las transiciones válidas; no hay ruta ni botón |
| Rechazar una inscripción | UC-16 | ⬜ | HU-05 | La base ya exige motivo (y admite nota de hasta 500 caracteres) en todo rechazo; no hay ruta ni botón |
| Ver el pipeline de una oferta | UC-17 | 🚧 | HU-04, HU-05 | Seis columnas con nombre, fecha del último cambio y motivo del rechazo, sin email, teléfono ni nota; vacío, error y «Página no encontrada»; una oferta cerrada o borrador por su URL; faltan A1 (acceso desde una oferta cerrada y el historial desde cada tarjeta, HU-05), las acciones «Avanzar» y «Rechazar» y A3 (feature A) |
| Consultar el historial de una inscripción | UC-18 | ⬜ | HU-05 | El historial se escribe y es inmutable (salvo vaciar la nota), pero ninguna pantalla ni ruta lo lee; las tarjetas y el 409 por duplicado van sin enlace |
| Rechazar las inscripciones activas al cerrar una oferta | UC-19 | ⬜ | HU-05 | Latente: el cierre de una oferta sigue con el stub `noJobApplications`, que no rechaza nada |

## Alcance no implementado

- **HU-05:** avanzar y rechazar (UC-15 y UC-16, con la etapa esperada y la idempotencia), el detalle de la inscripción con
  su historial (UC-18; `GET /api/applications/:id`, la ruta `/applications/:id` y los dos enlaces que dejó HU-04), el
  acceso al pipeline desde una oferta cerrada (UC-17 · A1) y el rechazo al cerrar una oferta (UC-19, que conecta
  `JobApplicationsPort` y cierra la ventana de INV-05); al pasar una inscripción a una etapa final, `candidatos` recalcula
  la retención.
- **Feature A:** el estado «anonimizado», su marca en el pipeline (UC-17 · A3, «Candidato anonimizado») y el vaciado de
  la nota al anonimizar (la base ya lo permite).
- **Fuera de FEAT-03:** exportación de la ficha, importación CSV, inscribir desde la ficha del candidato o a varios a la
  vez, y paginar el pipeline.

## Reglas de negocio

Las de FEAT-03, con su estado real en `main`.

**Implementadas**
- **RN-01** — solo se inscribe en ofertas `published`; en `draft` o `closed`, 409 `INVALID_TRANSITION` y no se crea nada.
- **RN-02** — una sola inscripción por candidato y oferta, para siempre y en cualquier etapa: el índice único decide y el
  409 `DUPLICATE` lleva el ID de la existente.
- **RN-03** — toda inscripción nace en `received` con su `StageChange` sin origen → `received`, con el mismo instante.
- **RN-11** — solo los rechazos llevan nota: lo impone la base (INV-10); hoy ninguna ruta la escribe y solo la lleva el seed.
- **RN-12** — el pipeline se ve también en ofertas cerradas, en solo lectura, con una columna por etapa ordenada por el último
  cambio (desempate por ID descendente), sin paginar, y solo con el nombre del candidato.
- **RN-13** — fechas en UTC y mostradas en Europe/Madrid como `dd/mm/aaaa`.

**Parciales**
- **RN-04** — las transiciones válidas (solo a la siguiente; `rejected` desde cualquier etapa no final; `hired` y `rejected`
  finales) las impone el `CHECK` de la base; falta el servicio que avanza y el 409 por transición no permitida (HU-05).
- **RN-05** — el motivo de la lista cerrada y la nota ≤ 500 caracteres los impone la base; falta rechazar con ellos y el
  aviso de no usarla para datos sensibles (HU-05).
- **RN-10** — al **crear** una inscripción, `candidatos` recalcula la retención en la misma transacción; falta al pasar
  una a etapa final (HU-05).

**Pendientes (HU-05)**
- **RN-06** — el cambio de etapa envía la etapa esperada; si no coincide, 409.
- **RN-07** — pedir la etapa actual da 200 sin crear `StageChange`; prevalece sobre RN-06.
- **RN-08** — contratar no toca las demás inscripciones ni cierra la oferta; se admite más de un `hired`.
- **RN-09** — al cerrar una oferta, sus inscripciones no finales pasan a `rejected` con el motivo «oferta cerrada», en la
  misma transacción del cierre.

**Invariantes.** INV-01, INV-03, INV-04, INV-07, INV-08 e INV-10 los defiende la base (índice único, triggers, `CHECK` y
FK `RESTRICT`); INV-02, INV-06 e INV-09 los garantiza la transacción de inscribir y los comprueba el seed (ver
[technical.md](technical.md)). **INV-05** (ninguna oferta cerrada con inscripciones no finales) **no se cumple todavía por
construcción**: ver «Cuestiones abiertas».

## Dependencias entre módulos

Dirección de las llamadas: `ofertas → inscripciones → candidatos` (DEC-06, aclarada en HU-04). Ningún módulo importa a otro:
los puertos se implementan por tipado estructural y se conectan en `apps/api/src/app.ts`.

- **Reales desde HU-04:**
  - `inscripciones` lee el estado de la oferta por `JobStatusPort`, que implementa `ofertas` (`apps/api/src/modules/jobs/job-status.ts`).
  - `inscripciones` lee la existencia y los nombres de los candidatos por `CandidateLookupPort`, que implementa
    `candidatos` (solo `id` y `full_name`).
  - `candidatos` lee los procesos del candidato por su `CandidateProcessesPort`, que implementa `inscripciones`
    (`apps/api/src/modules/applications/candidate-processes.ts`); `inscripciones` llama al recálculo de la retención
    de `candidatos` dentro de su transacción.
  - Las claves foráneas de `applications` a `candidates` y `job_openings` son integridad de la base, no acoplamiento: un
    candidato u oferta con inscripciones no se puede borrar.
  - En la web, `jobs` enlaza al pipeline y `applications` reutiliza el cliente de búsqueda de `candidates`.
- **Latente:** `JobApplicationsPort` (`ofertas` hacia `inscripciones`: contar y rechazar las inscripciones activas al
  cerrar) sigue con el stub `noJobApplications` hasta HU-05.

## Cuestiones abiertas

- **Ventana de INV-05 hasta HU-05 (DT-10):** con el puerto en stub, cerrar una oferta deja abiertas sus inscripciones y la
  retención de sus candidatos en `null`; el diálogo de cierre dice 0 inscripciones activas. Aceptada: el seed la respeta y
  ningún test cierra ofertas con inscripciones; tras el merge de HU-05, `npm run db:reset`.
- **Sin decidir en `docs/RGPD.md`, para la feature A:** si un candidato con la retención vencida puede inscribirse o aparecer
  en el buscador (hoy sí, DT-06); la marca de anonimizado en los puertos `exists` y `findNames`; y si la anonimización
  vacía siempre la nota del rechazo (el trigger ya lo permite, RGPD §5).
- UC-17 · E1 dice «estado de error» y la web muestra «Página no encontrada» (decisión del responsable técnico de no
  tocar el UC; review de HU-04, DD-02).
- El pipeline no pagina (S-18, aceptado): RNF-01 se midió con 200 inscripciones en una oferta.
- Aviso de la review de HU-04 para HU-05: `createApplicationsService` mide 54 líneas; sacar helpers antes de añadir avanzar y
  rechazar.
- Deuda de demo para `/audit-sprint`: integración en serie y e2e con *workers* acotados; *timeout* de los tests web
  justificado; medir la pasada completa en una máquina modesta (review de HU-04, §9.8).

## Estado vivo del MVP

- **% MVP:** ~25 % — `round((1 + 0,5 · 1) / 6 · 100)`.
- **Conteo:** 1 ✅ / 1 🚧 / 4 ⬜ (6 capacidades).
- **Backlog:** HU-05 (UC-15, UC-16, UC-18, UC-19 y UC-17 · A1; conectar `JobApplicationsPort`, recalcular al cerrar y cerrar
  la ventana de INV-05).

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-07 | HU-04 | Nace el módulo: inscribir desde el pipeline (API y web), pipeline de una oferta con seis columnas, migración 003 con historial inmutable (salvo vaciar la nota), puerto de procesos real, seed de 40 inscripciones, y SEC-02 y «Ver pipeline» en `ofertas` | ~25 % |
