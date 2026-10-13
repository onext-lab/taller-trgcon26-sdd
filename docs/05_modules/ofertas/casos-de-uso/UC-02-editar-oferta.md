---
id: UC-02
titulo: "Editar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-04
hus: [HU-01, HU-02, HU-07]
---

# UC-02 — Editar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador corrige o completa los datos de una oferta en `draft` o `published`.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador elige «Editar» en la ficha de una oferta (UC-08).

## Precondiciones
- La oferta existe y está en `draft` o `published` (RV-04).

## Flujo principal (P)
1. El reclutador abre la oferta en modo edición.
2. El reclutador modifica campos y guarda; puede poner, ampliar, reducir o quitar la fecha límite de inscripción
   (FEAT-04 · RN-05; R3).
3. El sistema recorta los espacios y valida los campos con las mismas reglas que al crear (RN-03, RN-04); la fecha
   límite se valida como en UC-01 solo si cambia (FEAT-04 · RN-03; R2).
4. El sistema guarda los cambios sin alterar el estado ni las fechas de la oferta.
5. El sistema muestra la ficha actualizada.

## Flujos alternativos
- **A1 — Edición concurrente** (desde el paso 4): otra pestaña guardó la misma oferta entre medias → se guarda esta
  edición y gana la última escritura; termina en el paso 5 (S-02).
- **A2 — Plazo vencido sin tocar** (desde el paso 3): la oferta tiene una fecha límite ya pasada y la edición no la
  cambia → la fecha no se valida contra hoy y se guarda el resto sin error por ella; termina en el paso 5 (FEAT-04 ·
  RN-03; R2).
- **A3 — Ampliar o quitar un plazo vencido** (desde el paso 4): la oferta `published` tiene el plazo vencido y la
  edición lo amplía a hoy o a una fecha futura, o lo quita → se guarda, la oferta sigue `published` y vuelve a admitir
  inscripciones (UC-14); termina en el paso 5 (FEAT-04 · RN-05; R3).

## Excepciones
- **E1 — Oferta cerrada** (en el paso 1): la oferta está en `closed` → la ficha es de solo lectura y no ofrece
  «Editar»; si la petición llega a la API, la rechaza con 409 y no cambia nada (RV-04, S-02).
- **E2 — Campo inválido** (en el paso 3): incumple alguna validación de UC-01 (E1-E6) → 400 junto al campo; la oferta
  queda como estaba (RV-01, S-03, S-08).
- **E3 — Vaciar un obligatorio de una publicada** (en el paso 3): la oferta está en `published` y la edición deja sin
  valor el título, la descripción, la ubicación o la modalidad → 400 junto al campo; la oferta queda como estaba
  (S-09).
- **E4 — Cerrada mientras se editaba** (en el paso 4): la oferta pasó a `closed` después de abrirse el formulario → 409
  como en E1; no cambia nada (RV-04, S-02).
- **E5 — Fecha límite no válida** (en el paso 3): la edición cambia la fecha límite a un valor que no es un día de
  calendario válido o que es anterior a hoy en Europe/Madrid → 400 junto al campo; la oferta queda como estaba
  (FEAT-04 · RN-03, RN-05; R2, R3).

## Reglas de negocio
- RN-03: formatos y recorte de los campos.
- RN-04: banda salarial opcional, con extremos independientes.
- RN-05: solo se editan las ofertas `draft` y `published`; una publicada mantiene los obligatorios; gana la última
  escritura.
- FEAT-04 · RN-03 y RN-05: la fecha límite se valida solo si cambia, nunca al pasado; en `draft` y `published` se
  pone, amplía, reduce o quita, y ampliar o quitar un plazo vencido reabre las inscripciones.

## Postcondiciones
- **Éxito:** la oferta tiene los valores nuevos, con el mismo estado y las mismas fechas de creación, publicación y
  cierre.
- **Fallo:** la oferta queda exactamente como estaba.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | CA-09, CA-10 | `apps/api/test/jobs/update.test.ts:40` |
| A1 | HU-01 | CA-11 | `apps/api/test/jobs/update.test.ts:85` |
| E1 | HU-02 | CA-10 | `apps/api/test/jobs/status-rules.test.ts:64` |
| E2 | HU-01 | CA-12 | `apps/api/test/jobs/update.test.ts:144` |
| E3 | HU-02 | CA-11 | `apps/api/test/jobs/status-rules.test.ts:74` |
| E4 | HU-02 | CA-12 | `apps/api/test/jobs/status-rules.test.ts:117` |
| P (FEAT-04) | HU-07 | | |
| A2 | HU-07 | | |
| A3 | HU-07 | | |
| E5 | HU-07 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
