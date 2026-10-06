---
id: UC-07
titulo: "Listar y buscar ofertas"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-01, HU-02]
---

# UC-07 — Listar y buscar ofertas

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador encuentra sus ofertas en un listado paginado, filtrado por estado y por texto del título.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador abre el listado de ofertas.

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador abre el listado de ofertas.
2. El sistema devuelve la primera página, de 20 ofertas de todos los estados, ordenadas por fecha de referencia (la de
   publicación o, si no hay, la de creación), de la más reciente a la más antigua, con desempate por ID (RV-08, S-04).
3. El sistema muestra cada oferta con su estado y su fecha de referencia en Europe/Madrid, en formato dd/mm/aaaa
   (RV-25, `docs/06_design_principles/README.md` §6).

## Flujos alternativos
- **A1 — Filtrar** (desde el paso 1): el reclutador filtra por estado, por un texto contenido en el título (sin
  distinguir mayúsculas ni tildes) o por ambos a la vez, que se combinan en Y → el sistema devuelve la primera página
  del resultado con el mismo orden; sigue en el paso 3 (RV-08, S-04).
- **A2 — Sin resultados** (desde el paso 2): no hay ofertas, o ninguna cumple el filtro, o la página pedida está más
  allá de la última → lista vacía y estado «vacío» en la pantalla (`docs/06_design_principles/README.md` §3).
- **A3 — Cambiar de página o de tamaño** (desde el paso 3): el reclutador pide otra página o un tamaño de página de
  1-100 → el sistema devuelve esa página con el mismo orden y filtros; sigue en el paso 3 (RV-08).

## Excepciones
- **E1 — Tamaño de página fuera de rango** (en el paso 2): más de 100 por página → 400 (S-04).
- **E2 — Texto de búsqueda inválido** (en el paso 2): el texto pasa de 100 caracteres o contiene caracteres de control
  → 400 (S-03).
- **E3 — Estado de filtro inválido** (en el paso 2): un estado distinto de `draft`, `published` o `closed` → 400
  (RV-03, S-03).
- **E4 — API no disponible** (en el paso 2): la web no obtiene respuesta → estado «error» en la pantalla, sin datos a
  medias (`docs/06_design_principles/README.md` §3).

## Reglas de negocio
- RN-11: filtros, orden y paginación del listado.
- RN-12: fechas en UTC, mostradas en Europe/Madrid.

## Postcondiciones
- **Éxito:** el reclutador ve la página pedida; el listado no cambia ningún dato.
- **Fallo:** no cambia ningún dato.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | CA-15, CA-16 | |
| A1 | HU-02 | | |
| A2 | HU-01 | CA-17 | |
| A3 | HU-02 | | |
| E1 | HU-02 | | |
| E2 | HU-02 | | |
| E3 | HU-02 | | |
| E4 | HU-01 | CA-18 | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
