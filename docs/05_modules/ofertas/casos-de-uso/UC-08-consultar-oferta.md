---
id: UC-08
titulo: "Consultar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-01, HU-02]
---

# UC-08 — Consultar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador ve todos los datos de una oferta y las acciones que permite su estado.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador abre una oferta desde el listado (UC-07) o tras crearla, editarla o duplicarla.

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador abre una oferta.
2. El sistema muestra el título, la descripción, la ubicación, la modalidad, la banda salarial, el estado y las fechas
   de creación, publicación y cierre que tenga, en Europe/Madrid y en formato dd/mm/aaaa (RV-25, S-10,
   `docs/06_design_principles/README.md` §6).
3. El sistema ofrece solo las acciones que permite el estado: en `draft`, editar, publicar, borrar y duplicar; en
   `published`, editar, cerrar y duplicar (RV-03, RV-04, RV-06, S-11).

## Flujos alternativos
- **A1 — Oferta cerrada** (desde el paso 3): la oferta está en `closed` → se muestra en solo lectura, con su fecha de
  cierre, y la única acción es duplicar (RV-03, RV-04, S-10, S-11).

## Excepciones
- **E1 — Oferta inexistente** (en el paso 2): el ID no existe o la oferta se borró → 404 con el envelope de DEC-01 y un
  mensaje en la pantalla; no se muestra ningún dato.

## Reglas de negocio
- RN-05: solo se editan las ofertas `draft` y `published`.
- RN-06: transiciones `draft → published → closed`.
- RN-09: solo se borran las ofertas `draft`.
- RN-12: fechas en UTC, mostradas en Europe/Madrid.

## Postcondiciones
- **Éxito:** el reclutador ve la oferta; la consulta no cambia ningún dato.
- **Fallo:** no cambia ningún dato.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | | |
| A1 | HU-02 | | |
| E1 | HU-01 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
