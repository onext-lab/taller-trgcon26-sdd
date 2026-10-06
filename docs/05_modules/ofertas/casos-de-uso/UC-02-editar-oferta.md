---
id: UC-02
titulo: "Editar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-01
hus: [HU-01, HU-02]
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
2. El reclutador modifica campos y guarda.
3. El sistema recorta los espacios y valida los campos con las mismas reglas que al crear (RN-03, RN-04).
4. El sistema guarda los cambios sin alterar el estado ni las fechas de la oferta.
5. El sistema muestra la ficha actualizada.

## Flujos alternativos
- **A1 — Edición concurrente** (desde el paso 4): otra pestaña guardó la misma oferta entre medias → se guarda esta
  edición y gana la última escritura; termina en el paso 5 (S-02).

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

## Reglas de negocio
- RN-03: formatos y recorte de los campos.
- RN-04: banda salarial opcional, con extremos independientes.
- RN-05: solo se editan las ofertas `draft` y `published`; una publicada mantiene los obligatorios; gana la última
  escritura.

## Postcondiciones
- **Éxito:** la oferta tiene los valores nuevos, con el mismo estado y las mismas fechas.
- **Fallo:** la oferta queda exactamente como estaba.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | CA-09, CA-10 | `apps/api/test/jobs/update.test.ts:40` |
| A1 | HU-01 | CA-11 | `apps/api/test/jobs/update.test.ts:85` |
| E1 | HU-02 | | |
| E2 | HU-01 | CA-12 | `apps/api/test/jobs/update.test.ts:144` |
| E3 | HU-02 | | |
| E4 | HU-02 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
