---
id: UC-03
titulo: "Publicar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-02]
---

# UC-03 — Publicar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador publica un borrador completo para que admita inscripciones (RV-17).

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador pulsa «Publicar» en la ficha de un borrador (UC-08).

## Precondiciones
- La oferta existe y está en `draft`.

## Flujo principal (P)
1. El reclutador pulsa «Publicar».
2. El sistema comprueba que el título, la descripción, la ubicación y la modalidad son válidos (RN-02).
3. El sistema pasa la oferta a `published` y guarda la fecha de publicación en UTC (RN-06, RN-12).
4. El sistema muestra la oferta publicada, con su fecha de publicación en Europe/Madrid.

## Flujos alternativos
- **A1 — Ya publicada** (desde el paso 1): la oferta ya está en `published` → 200 sin cambios; la fecha de publicación
  no se toca (S-01).

## Excepciones
- **E1 — Faltan obligatorios** (en el paso 2): falta algún campo obligatorio o no es válido → 400 con la lista de
  campos pendientes; la oferta sigue en `draft` (RV-01, RV-02).
- **E2 — Oferta cerrada** (en el paso 1): la oferta está en `closed` → 409; no cambia nada (RV-03, S-02).

## Reglas de negocio
- RN-02: publicar exige los campos obligatorios.
- RN-06: transiciones `draft → published → closed`; una transición no permitida da 409.
- RN-07: repetir una transición ya aplicada devuelve 200 sin cambios.
- RN-12: fechas en UTC, mostradas en Europe/Madrid.

## Postcondiciones
- **Éxito:** la oferta está en `published` con su fecha de publicación y admite inscripciones (RV-17).
- **Fallo:** la oferta queda en su estado anterior, sin cambios.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-02 | CA-01 | `apps/api/test/jobs/publish.test.ts:51` |
| A1 | HU-02 | CA-02 | `apps/api/test/jobs/publish.test.ts:65` |
| E1 | HU-02 | CA-03 | `apps/api/test/jobs/publish.test.ts:165` |
| E2 | HU-02 | CA-04 | `apps/api/test/jobs/publish.test.ts:197` |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
