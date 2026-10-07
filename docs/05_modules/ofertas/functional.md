# Módulo `ofertas` (código `jobs`) — Funcional

Estado de `main` sincronizado hasta **HU-06** (2026-10-07). Lo mantiene `/module-sync`; la foto técnica está en
[technical.md](technical.md).

## Propósito

El reclutador gestiona el ciclo de vida de las ofertas de empleo: las prepara como borrador, las publica, las edita,
las cierra, las duplica y las encuentra en un listado con filtros. Es la base de `inscripciones`: sin ofertas
publicadas no hay dónde inscribir candidatos (FEAT-01, IDEA-001).

## Alcance objetivo

El de FEAT-01: crear, editar, publicar, cerrar, borrar (solo borradores), duplicar, listar con filtros y consultar
ofertas, en API y web; la invocación, dentro del cierre, del rechazo de inscripciones activas (UC-19); y unas 10
ofertas inventadas en el seed. Fuera: número de vacantes, reabrir una oferta cerrada (se duplica), portales externos,
login y enlace entre una duplicada y su original.

## Actores

Un único actor, el **reclutador**, sin login (DEC-04). Ningún proceso programado dispara capacidades del módulo.

## Capacidades

Una por caso de uso del [catálogo del módulo](casos-de-uso/README.md). El estado sale de la review de cada HU.

| Capacidad | UC | Estado | HU | Qué hay hoy |
|---|---|---|---|---|
| Crear una oferta como borrador | UC-01 | ✅ | HU-01 | Alta con solo el título o completa; recorte y validación junto al campo |
| Editar una oferta | UC-02 | ✅ | HU-01, HU-02 | Edición de borradores y publicadas con última escritura; una publicada mantiene los obligatorios; una cerrada da 409 |
| Publicar una oferta | UC-03 | ✅ | HU-02 | Publica un borrador completo, o avisa de los campos pendientes; repetir da 200 sin cambios |
| Cerrar una oferta | UC-04 | ✅ | HU-02, HU-06 | Cierra con un diálogo que anuncia el número real de inscripciones activas; en una transacción pasa la oferta a `closed` y, desde HU-06 (A1), rechaza esas inscripciones con «oferta cerrada» por el puerto real de `inscripciones` (UC-19); un fallo deshace todo; repetir da 200 sin cambios; un borrador da 409 |
| Borrar un borrador | UC-05 | ✅ | HU-01, HU-02 | Borrado físico con confirmación; una publicada o cerrada da 409 |
| Duplicar una oferta como borrador | UC-06 | ✅ | HU-02 | Copia los campos editables de una oferta de cualquier estado como borrador nuevo |
| Listar y buscar ofertas | UC-07 | ✅ | HU-01, HU-02 | Filtros por estado y título (sin tildes ni mayúsculas), paginación y tamaño 20, 50 o 100, con vacío y error |
| Consultar una oferta | UC-08 | ✅ | HU-01, HU-02 | Ficha con las acciones de su estado; una cerrada es de solo lectura y solo se duplica |

## Alcance no implementado

- Nada de FEAT-01. Fuera de su alcance: número de vacantes, reabrir una oferta cerrada (se duplica), portales externos,
  login y enlace entre una duplicada y su original.

## Reglas de negocio

Las de FEAT-01, con su estado real en `main`.

**Implementadas**
- **RN-01** — un borrador se guarda con solo un título válido.
- **RN-03** — recorte antes de validar, longitudes, modalidad en `presencial | híbrida | remota` y 400 ante un campo
  desconocido o de solo lectura. Además, los caracteres de control dan 400 (EC-50, DEC-11.8).
- **RN-04** — extremos de la banda opcionales e independientes, enteros > 0, mínimo ≤ máximo si vienen los dos.
- **RN-12** — fechas en UTC (ISO 8601) mostradas en Europe/Madrid como `dd/mm/aaaa`.
- **RN-02** — publicar exige título, descripción, ubicación y modalidad; si faltan, 400 con la lista.
- **RN-05** — se editan `draft` y `published` (una publicada mantiene los obligatorios), con última escritura; una
  `closed` da 409.
- **RN-06** — transiciones `draft → published → closed`; cualquier otra da 409 `INVALID_TRANSITION`.
- **RN-07** — repetir una transición ya aplicada da 200 sin cambios ni nueva fecha.
- **RN-09** — solo se borra un `draft` (físico); una publicada o cerrada da 409.
- **RN-10** — duplicar copia los campos editables como borrador, sin fechas, sin inscripciones y sin enlace.
- **RN-11** — orden por fecha de referencia descendente con desempate por ID, filtros en Y por estado y título, página
  de 20 por defecto y tope de 100.
- **RN-13** — la oferta no tiene vacantes: solo la cierra el reclutador.
- **RN-08** — el cierre es una sola transacción: estado `closed`, fecha de cierre y rechazo de las inscripciones activas
  por `inscripciones` (UC-19, desde HU-06), con la misma fecha; si algo falla, no cambia nada.

INV-01, INV-04 e INV-05 se defienden también en la base desde la migración 001 (ver [technical.md](technical.md)).

## Dependencias entre módulos

- **Real desde HU-04 (DEC-06):** `jobs` no importa otros módulos ni lo importa nadie. `inscripciones` define el puerto
  «estado de la oferta» y `jobs` lo implementa (`apps/api/src/modules/jobs/job-status.ts`), conectado en
  `apps/api/src/app.ts`; la web de `jobs` enlaza a la ruta del pipeline («Ver pipeline»). Dirección:
  `ofertas → inscripciones → candidatos`.
- **Real desde HU-06:** hacia `inscripciones`, el puerto propio `JobApplicationsPort`
  (`apps/api/src/modules/jobs/applications-port.ts`) lo implementa `inscripciones`
  (`apps/api/src/modules/applications/job-closing.ts`) y lo conecta `composeServices` en `apps/api/src/app.ts`: cuenta
  las inscripciones activas para el diálogo y las rechaza dentro de la transacción del cierre. El stub
  `noJobApplications` solo queda como doble para tests.

## Cuestiones abiertas

- **INV-05 se cumple por construcción desde HU-06:** el test de EC-14 de HU-02, que fijaba la ventana, se retiró y lo
  sustituyen los tests del cierre real (`apps/api/test/applications/close-reject.test.ts`,
  `apps/api/test/applications/close-reject-adversarial.test.ts` y `apps/api/test/applications/close-invariants.test.ts`).
  Tras el merge de HU-06, `npm run db:reset` en cada base creada durante la ventana.
- Avisos de la review de HU-02, cumplidos: HU-03 cerró el `details` sin tope (SEC-03) y reutilizó `NO_CONTROL_CHARS*` y
  `foldSearchText`; HU-06 conectó el puerto (con retención y `StageChange`) y probó que sus errores no llevan datos del
  candidato al log (`apps/api/test/applications/close-reject-privacy.test.ts`).

## Estado vivo del MVP

- **% MVP:** 100 % — `round((8 + 0,5 · 0) / 8 · 100)`.
- **Conteo:** 8 ✅ / 0 🚧 / 0 ⬜ (8 capacidades).
- **Backlog:** ninguno de FEAT-01.

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-06 | HU-01 | Crear, editar, borrar, listar y consultar borradores (API, web, migración 001 y seed de 4) | ~38 % |
| 2026-10-06 | HU-02 | Publicar, cerrar, duplicar, editar y borrar según el estado, listado con filtros y paginación, guarda DEC-12 y seed de 10 | ~94 % |
| 2026-10-07 | HU-06 | UC-04 · A1: el cierre rechaza las inscripciones activas en su transacción por el puerto real de `inscripciones`, y el diálogo anuncia el número real | 100 % |
