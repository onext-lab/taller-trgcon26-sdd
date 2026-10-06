# Módulo `ofertas` (código `jobs`) — Funcional

Estado de `main` sincronizado hasta **HU-01** (2026-10-06). Lo mantiene `/module-sync`; la foto técnica está en
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
| Editar una oferta | UC-02 | 🚧 | HU-01, HU-02 | Edición de borradores con última escritura; falta `published`/`closed` (E1, E3, E4) |
| Publicar una oferta | UC-03 | ⬜ | HU-02 | — |
| Cerrar una oferta | UC-04 | ⬜ | HU-02, HU-05 | — (A1, rechazo de inscripciones activas: HU-05) |
| Borrar un borrador | UC-05 | 🚧 | HU-01, HU-02 | Borrado físico con confirmación; falta rechazar las no `draft` (E1) |
| Duplicar una oferta como borrador | UC-06 | ⬜ | HU-02 | — |
| Listar y buscar ofertas | UC-07 | 🚧 | HU-01, HU-02 | Primera página de 20, ordenada, con vacío y error; faltan filtros y paginación |
| Consultar una oferta | UC-08 | 🚧 | HU-01, HU-02 | Ficha completa con «Editar» y «Borrar»; falta la ficha de una cerrada (A1) |

## Alcance no implementado

- **HU-02:** publicar, cerrar y duplicar; editar y borrar ofertas `published` o `closed` con sus 409; filtros por
  estado y título, cambio de página y de tamaño; ficha de una oferta cerrada; las acciones «Publicar», «Cerrar» y
  «Duplicar»; las 6 ofertas restantes del seed (4 `published` y 2 `closed`).
- **HU-05:** UC-04 · A1, el rechazo de las inscripciones activas al cerrar, cuando exista UC-19.

## Reglas de negocio

Las de FEAT-01, con su estado real en `main`.

**Implementadas**
- **RN-01** — un borrador se guarda con solo un título válido.
- **RN-03** — recorte antes de validar, longitudes, modalidad en `presencial | híbrida | remota` y 400 ante un campo
  desconocido o de solo lectura. Además, los caracteres de control dan 400 (EC-50, DEC-11.8).
- **RN-04** — extremos de la banda opcionales e independientes, enteros > 0, mínimo ≤ máximo si vienen los dos.
- **RN-12** — fechas en UTC (ISO 8601) mostradas en Europe/Madrid como `dd/mm/aaaa`.

**Parciales**
- **RN-05** — la edición con última escritura funciona para borradores; las reglas de `published` (mantener los
  obligatorios) y `closed` (no se edita) llegan con HU-02.
- **RN-09** — el borrado es físico; «solo se borra un `draft`» no se comprueba todavía porque no hay otros estados.
- **RN-11** — orden por fecha de referencia descendente con desempate por ID y primera página de 20; filtros,
  paginación y tope de 100: HU-02.

**Pendientes**
- **RN-02** (obligatorios para publicar), **RN-06** (transiciones `draft → published → closed`), **RN-07** (repetir
  una transición da 200 sin cambios), **RN-08** (cierre en una transacción con UC-19), **RN-10** (duplicar) y
  **RN-13** (la oferta no tiene vacantes; la cierra el reclutador): HU-02, salvo la parte de UC-19 de RN-08 (HU-05).
  INV-01, INV-04 e INV-05 ya están defendidas en la base por adelantado (ver [technical.md](technical.md)).

## Dependencias entre módulos

- **Hoy, ninguna real:** `jobs` no importa otros módulos ni lo importa nadie.
- **Latentes (DEC-06):** `ofertas` implementará el puerto «estado de la oferta» que define `inscripciones` (HU-04) e
  invocará en el cierre la operación interna de UC-19 (HU-05). Dirección: `ofertas → inscripciones → candidatos`.

## Cuestiones abiertas

Ninguna funcional. Avisos de la review de HU-01 para las siguientes: HU-02 comprueba el estado en `service.update` y
`service.remove`; HU-03 reutiliza `NO_CONTROL_CHARS*`.

## Estado vivo del MVP

- **% MVP:** ~38 % — `round((1 + 0,5 · 4) / 8 · 100)`.
- **Conteo:** 1 ✅ / 4 🚧 / 3 ⬜ (8 capacidades).
- **Backlog:** HU-02 (ciclo de vida, filtros y paginación) y HU-05 (UC-04 · A1).

| Fecha | HU | Qué entregó | % MVP |
|---|---|---|---|
| 2026-10-06 | HU-01 | Crear, editar, borrar, listar y consultar borradores (API, web, migración 001 y seed de 4) | ~38 % |
