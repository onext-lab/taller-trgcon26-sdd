# Módulo `candidatos` (código `candidates`) — Funcional

Estado de `main` sincronizado hasta **HU-06** (2026-10-07; HU-05 y HU-06 solo tocan quién llama al recálculo de la
retención). Lo mantiene `/module-sync`; la foto técnica está en [technical.md](technical.md).

## Propósito

El reclutador da de alta candidatos, corrige sus fichas, los encuentra por nombre, email o skill y consulta su ficha
completa. Cada ficha guarda datos personales, así que el consentimiento para futuros procesos y la fecha de fin de
retención son correctos desde el alta: el reclutador registra, renueva o retira el consentimiento y el sistema calcula
siempre la retención con una fórmula única. Es la base de `inscripciones`: sin fichas no hay a quién inscribir en las
ofertas (FEAT-02, IDEA-002).

## Alcance objetivo

El de FEAT-02: alta, edición (también del email), búsqueda y listado, ficha y consentimiento, en API y web; la fórmula
de retención completa y su recálculo, con el puerto de lectura de los procesos del candidato; y 30 candidatos
inventados en el seed. Fuera: el estado «anonimizado», la anonimización y la exclusión de anonimizados de las búsquedas
(feature A), la exportación de la ficha por derecho de acceso, la importación CSV (feature C) y el borrado físico, que no
existe.

## Actores

Un único actor, el **reclutador**, sin login (DEC-04). El candidato es el interesado cuyos datos se tratan; no usa la
aplicación, y el consentimiento lo marca el reclutador declarando que el candidato lo dio. Ningún proceso programado
dispara capacidades del módulo: el vencimiento de la retención lo ejecutará la feature A.

## Capacidades

Una por caso de uso del [catálogo del módulo](casos-de-uso/README.md). El estado sale de la review de cada HU.

| Capacidad | UC | Estado | HU | Qué hay hoy |
|---|---|---|---|---|
| Dar de alta un candidato | UC-09 | ✅ | HU-03 | Alta con email y skills normalizados, con o sin consentimiento; retención calculada; email repetido avisa sin mostrar datos del otro candidato |
| Editar la ficha de un candidato | UC-10 | ✅ | HU-03 | Edición de nombre, email, teléfono, resumen y skills con última escritura; no toca la retención ni el consentimiento; sin cambios, no hay petición |
| Buscar candidatos | UC-11 | ✅ | HU-03 | Texto sin tildes ni mayúsculas en nombre o email y una skill exacta, en Y; solo nombre, email y skills; página de 20, 50 o 100; la búsqueda no va en la URL |
| Ver la ficha de un candidato | UC-12 | ✅ | HU-03, HU-04 | Ficha con datos, consentimiento (vigente, retirado o nunca dado) y fin de retención en solo lectura; con una inscripción abierta muestra «Mientras dure el proceso», también si la fecha anterior ya había vencido |
| Registrar, retirar o renovar el consentimiento | UC-13 | ✅ | HU-03 | Casilla que registra, «Renovar consentimiento» y retirada con confirmación; la retención se recalcula en la misma transacción, aunque el resultado ya esté vencido |

## Alcance no implementado

- **Feature A:** anonimización (a petición o al vencer la retención), estado «anonimizado» y su exclusión de las
  búsquedas; mientras tanto, los candidatos con la retención vencida siguen en el listado sin marca.
- **Fuera de FEAT-02:** exportación de la ficha (RGPD §4), importación CSV y borrado físico.

## Reglas de negocio

Las de FEAT-02, con su estado real en `main`.

**Implementadas**
- **RN-01** — nombre y apellidos 2-100 y email obligatorios; teléfono, resumen (≤ 2 000) y skills opcionales; un fallo da
  400 junto al campo y no guarda nada.
- **RN-02** — recorte antes de validar, solo espacios equivale a vacío, esquema estricto (un campo desconocido o de solo
  lectura da 400), `q` ≤ 100 sin caracteres de control; los de control dan 400 también en nombre, email, teléfono y skills.
- **RN-03** — email recortado y en minúsculas, único; repetido (sin distinguir mayúsculas) → 409 con el ID del existente.
  Se puede cambiar manteniendo la unicidad.
- **RN-04** — skills recortadas, en minúsculas, sin vacías ni repetidas antes de contar: de 0 a 20, de ≤ 40 cada una.
- **RN-05** — consentimiento opcional, desmarcado por defecto; al marcarlo se guardan la fecha (la del sistema) y la versión
  `v1`; al retirarlo se conservan otorgamiento y versión; marcarlo con uno vigente lo renueva; retirar sin uno vigente es
  200 sin cambios. Un único estado por candidato, sin historial.
- **RN-06** — la retención la calcula siempre el sistema: ni la API ni la web la editan.
- **RN-07** — la fórmula está completa y probada con todas las filas de RGPD §3, y se recalcula al dar de alta, al cambiar
  el consentimiento, al inscribir (con una inscripción abierta, `null` aunque el consentimiento esté vigente o retirado y
  aunque la fecha anterior ya hubiera vencido) y al cerrar inscripciones: al avanzar o rechazar a una etapa final (HU-05)
  y al cerrar una oferta (HU-06), con «cierre + 6 meses» si no le queda otro proceso abierto.
- **RN-08** — búsqueda parcial y literal en nombre o email más una skill exacta, en Y; orden por alta descendente con
  desempate por ID; 20 por página, máximo 100; el listado solo lleva nombre, email y skills.
- **RN-09** — fechas en UTC y mostradas en Europe/Madrid como `dd/mm/aaaa`; plazos de retención por día natural de Madrid.
- **RN-10** — editar no recalcula la retención.
- **RN-11** — en la edición gana la última escritura.
- **RN-12** — `candidatos` define el puerto de procesos y exporta el recálculo; `inscripciones` implementa el puerto (por
  defecto en `buildApp`) y llama al recálculo al inscribir, al pasar una inscripción a una etapa final y al rechazarla
  por el cierre de su oferta. El stub `noCandidateProcesses` solo queda para tests y el seed.
- **RN-13** — no existe el borrado: `DELETE /api/candidates/:id` da 404.

INV-01, INV-02 (email), INV-04 y el rango de longitudes se defienden también en la base desde la migración 002 (ver
[technical.md](technical.md)); INV-07 se cumple con una sola transacción para candidato, consentimiento y retención.

## Dependencias entre módulos

- **Reales desde HU-04 (DEC-06):** `candidates` no importa otros módulos ni lo importa nadie; se relaciona con
  `inscripciones` por puertos que `apps/api/src/app.ts` conecta. Dirección: `ofertas → inscripciones → candidatos`.
  - `candidatos` define `CandidateProcessesPort` (`apps/api/src/modules/candidates/processes-port.ts`) y lo implementa
    `inscripciones` (`apps/api/src/modules/applications/candidate-processes.ts`).
  - `inscripciones` define `CandidateLookupPort` (¿existe? y nombres de candidatos) y lo implementa `candidatos` con
    `exists` y `findNames`, solo con `id` y `full_name`.
  - `inscripciones` llama a la operación interna `recalculateRetention` dentro de su transacción: al inscribir (HU-04),
    al avanzar o rechazar a una etapa final (HU-05) y al rechazar las activas cuando se cierra una oferta (HU-06,
    `apps/api/src/modules/applications/job-closing.ts`).
  - Las claves foráneas de `applications` a `candidates` impiden borrar un candidato con inscripciones (integridad de la
    base, no acoplamiento de código).

## Cuestiones abiertas

- Candidatos con la retención vencida siguen en el listado sin marca, hasta la feature A (decisión del responsable en la
  review de HU-03).
- Sin decidir en `docs/RGPD.md`, para la feature A (review de HU-04, §9.7): si un candidato con la retención vencida puede
  inscribirse o aparecer en el buscador (hoy sí, DT-06) y la marca de anonimizado en `exists` y `findNames`.
- Deuda DP-02 de HU-04 para la feature A: `recalculateRetention` lee la ficha con `SELECT *` (sin fuga; desde HU-06,
  dos lecturas por candidato en cada cierre de oferta; ver [technical.md](technical.md)).
- El texto de cada versión del consentimiento se conserva en el repositorio (`apps/web/src/features/candidates/consent.ts` y
  su historial de git); cambiar el texto obliga a subir la versión (RGPD §2).

## Estado vivo del MVP

- **% MVP:** 100 % — `round(5 / 5 · 100)`.
- **Conteo:** 5 ✅ / 0 🚧 / 0 ⬜ (5 capacidades).
- **Backlog:** ninguno propio del módulo; la anonimización y la marca de vencidos son de la feature A.

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-06 | HU-03 | Alta, edición, búsqueda, ficha y consentimiento (API, web, migración 002 y seed de 30), fórmula de retención y puerto de procesos con stub, y `details` acotado (DEC-11.4) | ~90 % |
| 2026-10-07 | HU-04 | UC-12 · A1 «Mientras dure el proceso» de punta a punta: puerto de procesos real, recálculo al inscribir, lecturas `exists` y `findNames` para `inscripciones`, y seed con la retención recalculada | 100 % |
