# Módulo `ofertas` (código `jobs`) — Funcional

Estado de `main` sincronizado hasta **HU-02** (2026-10-06). Lo mantiene `/module-sync`; la foto técnica está en
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
| Cerrar una oferta | UC-04 | 🚧 | HU-02, HU-05 | Cierra con diálogo y en una transacción, con el puerto de inscripciones (stub); falta A1, el rechazo de inscripciones activas (HU-05) |
| Borrar un borrador | UC-05 | ✅ | HU-01, HU-02 | Borrado físico con confirmación; una publicada o cerrada da 409 |
| Duplicar una oferta como borrador | UC-06 | ✅ | HU-02 | Copia los campos editables de una oferta de cualquier estado como borrador nuevo |
| Listar y buscar ofertas | UC-07 | ✅ | HU-01, HU-02 | Filtros por estado y título (sin tildes ni mayúsculas), paginación y tamaño 20, 50 o 100, con vacío y error |
| Consultar una oferta | UC-08 | ✅ | HU-01, HU-02 | Ficha con las acciones de su estado; una cerrada es de solo lectura y solo se duplica |

## Alcance no implementado

- **HU-05:** UC-04 · A1, el rechazo de las inscripciones activas al cerrar, cuando exista UC-19 (hoy el puerto
  `JobApplicationsPort` es el stub `noJobApplications`).

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

**Parciales**
- **RN-08** — el cierre es una transacción (estado, fecha y llamada al puerto), pero hoy el puerto no rechaza nada:
  falta el rechazo de las inscripciones activas (UC-19, HU-05).

INV-01, INV-04 e INV-05 se defienden también en la base desde la migración 001 (ver [technical.md](technical.md)).

## Dependencias entre módulos

- **Hoy, ninguna real:** `jobs` no importa otros módulos ni lo importa nadie. Hacia `inscripciones` solo hay un puerto
  propio, `JobApplicationsPort` (`apps/api/src/modules/jobs/applications-port.ts`), que `buildApp` inyecta con el stub
  `noJobApplications` (`jobApplications?`): cuenta 0 y no rechaza nada.
- **Latentes (DEC-06):** HU-05 aporta la implementación real del puerto (UC-19, dentro de la transacción del cierre);
  `ofertas` implementará además el puerto «estado de la oferta» que define `inscripciones` (HU-04). Dirección:
  `ofertas → inscripciones → candidatos`.

## Cuestiones abiertas

- **Ventana tolerada de INV-05 hasta HU-05:** mientras el puerto sea el stub, una oferta cerrada puede tener
  inscripciones en etapa no final. Hoy no existen inscripciones; el test de EC-14
  (`apps/api/test/jobs/close.test.ts:202`) lo fija y HU-05 lo sustituye al conectar UC-19.
- Avisos de la review de HU-02: HU-03 cerró el `details` sin tope (SEC-03) y reutilizó `NO_CONTROL_CHARS*` y
  `foldSearchText`; queda HU-05, que conecta el puerto (con retención y `StageChange`) y añade el test de que sus errores
  no llevan datos del candidato al log.

## Estado vivo del MVP

- **% MVP:** ~94 % — `round((7 + 0,5 · 1) / 8 · 100)`.
- **Conteo:** 7 ✅ / 1 🚧 / 0 ⬜ (8 capacidades).
- **Backlog:** HU-05 (UC-04 · A1, el rechazo de las inscripciones activas al cerrar).

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-06 | HU-01 | Crear, editar, borrar, listar y consultar borradores (API, web, migración 001 y seed de 4) | ~38 % |
| 2026-10-06 | HU-02 | Publicar, cerrar, duplicar, editar y borrar según el estado, listado con filtros y paginación, guarda DEC-12 y seed de 10 | ~94 % |
