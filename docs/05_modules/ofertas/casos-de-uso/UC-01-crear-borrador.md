---
id: UC-01
titulo: "Crear una oferta como borrador"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-04
hus: [HU-01]
---

# UC-01 — Crear una oferta como borrador

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

**Origen:** FEAT-01. **Modificado por:** FEAT-04 (fecha límite de inscripción); lo marcado «(FEAT-04)» está pendiente
de su HU.

## Objetivo
El reclutador da de alta una oferta en `draft` para completarla y publicarla más adelante.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador elige «Nueva oferta».

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador escribe al menos el título y, si quiere, la descripción, la ubicación, la modalidad y la banda
   salarial y, (FEAT-04), la fecha límite de inscripción; vacía, la oferta no tiene plazo (FEAT-04 · RN-01).
2. El sistema recorta los espacios de los textos y valida los campos informados (RN-03, RN-04); (FEAT-04) la fecha
   límite, si viene, es un día `AAAA-MM-DD` existente, de hoy o posterior en Europe/Madrid (FEAT-04 · RN-05, RN-06).
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
- **E7 — Fecha límite inválida o pasada** (en el paso 2) (FEAT-04): la fecha límite no es un día `AAAA-MM-DD`
  existente (formato distinto, 30/02, con hora o un número) o es anterior a hoy en Europe/Madrid → 400 junto al campo;
  no se crea nada. La de hoy sí vale (FEAT-04 · RN-05, RN-06).

## Reglas de negocio
- RN-01: un borrador se guarda con solo el título.
- RN-03: formatos y recorte de los campos.
- RN-04: banda salarial opcional, con extremos independientes.
- RN-12: fechas en UTC, mostradas en Europe/Madrid.
- FEAT-04 · RN-01: la fecha límite de inscripción es opcional; vacía = sin plazo.
- FEAT-04 · RN-05: al crear, la fecha límite no puede ser anterior a hoy (Europe/Madrid).
- FEAT-04 · RN-06: la fecha límite es un día `AAAA-MM-DD` existente, sin fecha máxima.

## Postcondiciones
- **Éxito:** existe una oferta nueva en `draft` con su fecha de creación, y aparece en el listado (UC-07).
- **Fallo:** no se crea ninguna oferta.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | CA-01, CA-02 | `apps/api/test/jobs/create.test.ts:47` |
| E1 | HU-01 | CA-03 | `apps/api/test/jobs/create.test.ts:169` |
| E2 | HU-01 | CA-04 | `apps/api/test/jobs/create.test.ts:169` |
| E3 | HU-01 | CA-05 | `apps/api/test/jobs/create.test.ts:193` |
| E4 | HU-01 | CA-06 | `apps/api/test/jobs/create.test.ts:169` |
| E5 | HU-01 | CA-07 | `apps/api/test/jobs/create.test.ts:220` |
| E6 | HU-01 | CA-08 | `apps/api/test/jobs/create-adversarial.test.ts:92` |
| P (FEAT-04) | — (pendiente) | | |
| E7 (FEAT-04) | — (pendiente) | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
