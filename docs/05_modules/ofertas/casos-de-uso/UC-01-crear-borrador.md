---
id: UC-01
titulo: "Crear una oferta como borrador"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-01]
---

# UC-01 — Crear una oferta como borrador

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador da de alta una oferta en `draft` para completarla y publicarla más adelante.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador elige «Nueva oferta».

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador escribe al menos el título y, si quiere, la descripción, la ubicación, la modalidad y la banda
   salarial.
2. El sistema recorta los espacios de los textos y valida los campos informados (RN-03, RN-04).
3. El sistema guarda la oferta en `draft` con su fecha de creación en UTC (RN-01, RN-12).
4. El sistema muestra la ficha de la oferta (UC-08).

## Flujos alternativos
- Ninguno.

## Excepciones
- **E1 — Título inválido** (en el paso 2): título ausente, de solo espacios o fuera de 3-120 caracteres → 400 con el
  mensaje junto al campo; no se crea nada (RV-01, RV-02, S-03).
- **E2 — Descripción demasiado larga** (en el paso 2): más de 5 000 caracteres → 400 junto al campo; no se crea nada
  (RV-01).
- **E3 — Modalidad inválida** (en el paso 2): valor distinto de `presencial`, `híbrida` o `remota` → 400; no se crea
  nada (RV-01).
- **E4 — Ubicación inválida** (en el paso 2): informada con menos de 2 o más de 120 caracteres tras el recorte → 400;
  no se crea nada (S-03).
- **E5 — Banda salarial inválida** (en el paso 2): un extremo que no es un entero > 0, o mínimo > máximo cuando vienen
  los dos → 400; no se crea nada (RV-01, S-08).
- **E6 — Campo desconocido o de solo lectura** (en el paso 2): la petición trae un campo que no existe o que fija el
  sistema (estado, fechas) → 400; no se crea nada (S-03).

## Reglas de negocio
- RN-01: un borrador se guarda con solo el título.
- RN-03: formatos y recorte de los campos.
- RN-04: banda salarial opcional, con extremos independientes.
- RN-12: fechas en UTC, mostradas en Europe/Madrid.

## Postcondiciones
- **Éxito:** existe una oferta nueva en `draft` con su fecha de creación, y aparece en el listado (UC-07).
- **Fallo:** no se crea ninguna oferta.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | | |
| E1 | HU-01 | | |
| E2 | HU-01 | | |
| E3 | HU-01 | | |
| E4 | HU-01 | | |
| E5 | HU-01 | | |
| E6 | HU-01 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
