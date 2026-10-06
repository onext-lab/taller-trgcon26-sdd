---
id: UC-05
titulo: "Borrar un borrador"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-01, HU-02]
---

# UC-05 — Borrar un borrador

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador elimina un borrador que ya no necesita.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Borrar» en la ficha de un borrador (UC-08).

## Precondiciones
- La oferta existe y está en `draft`.

## Flujo principal (P)
1. El reclutador pulsa «Borrar».
2. El sistema elimina la oferta físicamente (S-12).
3. El sistema vuelve al listado (UC-07), donde la oferta ya no aparece.

## Flujos alternativos
- Ninguno.

## Excepciones
- **E1 — Oferta publicada o cerrada** (en el paso 1): la oferta está en `published` o `closed` → la ficha no ofrece
  «Borrar» y la API rechaza la petición con 409; no cambia nada (RV-06, S-02).
- **E2 — Oferta ya borrada** (en el paso 2): la oferta no existe (p. ej., un segundo clic) → 404 con el envelope de
  DEC-01; no cambia nada (S-12, DEC-07).

## Reglas de negocio
- RN-09: solo se borran las ofertas `draft`, y el borrado es físico.

## Postcondiciones
- **Éxito:** la oferta deja de existir.
- **Fallo:** la oferta queda como estaba.

## Datos personales
Ninguno. Un borrador no tiene inscripciones, porque solo se inscribe en ofertas `published` (RV-17).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | | |
| E1 | HU-02 | | |
| E2 | HU-01 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
