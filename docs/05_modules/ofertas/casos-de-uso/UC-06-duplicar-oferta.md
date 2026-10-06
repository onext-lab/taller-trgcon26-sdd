---
id: UC-06
titulo: "Duplicar una oferta como borrador"
modulo: ofertas
actor: reclutador
estado: borrador
feature: FEAT-01
hus: []
---

# UC-06 — Duplicar una oferta como borrador

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador crea un borrador nuevo a partir de una oferta existente; es la forma de «reabrir» una oferta cerrada
(RV-03).

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Duplicar» en la ficha de una oferta (UC-08).

## Precondiciones
- La oferta de origen existe, en cualquier estado (S-11).

## Flujo principal (P)
1. El reclutador pulsa «Duplicar».
2. El sistema crea una oferta nueva en `draft` con los campos editables de la original (título, descripción, ubicación,
   modalidad y banda salarial), sin fechas de publicación ni de cierre, sin inscripciones y sin enlace a la original;
   su fecha de creación es la del momento (S-11, RN-10).
3. El sistema muestra la ficha del borrador nuevo, listo para editar (UC-02).

## Flujos alternativos
- Ninguno.

## Excepciones
- Ninguna.

## Reglas de negocio
- RN-06: `closed` es final; para reabrir, se duplica.
- RN-10: duplicar copia los campos editables, sin fechas, sin inscripciones y sin enlace.

## Postcondiciones
- **Éxito:** existe un borrador nuevo; la oferta original y sus inscripciones quedan intactas.

## Datos personales
Ninguno. No se copian inscripciones (S-11).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
