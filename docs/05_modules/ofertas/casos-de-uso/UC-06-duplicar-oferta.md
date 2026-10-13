---
id: UC-06
titulo: "Duplicar una oferta como borrador"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-04
hus: [HU-02, HU-07]
---

# UC-06 — Duplicar una oferta como borrador

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

**Origen:** FEAT-01. **Modificado por:** FEAT-04 (fecha límite de inscripción); lo marcado «(FEAT-04)» está pendiente
de HU-07.

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
   su fecha de creación es la del momento (S-11, RN-10). (FEAT-04) Tampoco copia la fecha límite de inscripción: el
   borrador nuevo nace sin plazo (FEAT-04 · RN-09; R4).
3. El sistema muestra la ficha del borrador nuevo, listo para editar (UC-02).

## Flujos alternativos
- Ninguno.

## Excepciones
- Ninguna.

## Reglas de negocio
- RN-06: `closed` es final; para reabrir, se duplica.
- RN-10: duplicar copia los campos editables, sin fechas, sin inscripciones y sin enlace.
- FEAT-04 · RN-09: duplicar no copia la fecha límite de inscripción.

## Postcondiciones
- **Éxito:** existe un borrador nuevo; la oferta original y sus inscripciones quedan intactas.

## Datos personales
Ninguno. No se copian inscripciones (S-11).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-02 | CA-14, CA-15 | `apps/api/test/jobs/duplicate.test.ts:46` |
| P (FEAT-04) | HU-07 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
