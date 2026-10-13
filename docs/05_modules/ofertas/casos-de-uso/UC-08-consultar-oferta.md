---
id: UC-08
titulo: "Consultar una oferta"
modulo: ofertas
actor: reclutador
estado: aprobado
feature: FEAT-04
hus: [HU-01, HU-02, HU-07]
---

# UC-08 — Consultar una oferta

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

**Origen:** FEAT-01. **Modificado por:** FEAT-04 (fecha límite de inscripción); lo marcado «(FEAT-04)» está pendiente
de HU-07.

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
   `docs/06_design_principles/README.md` §6). (FEAT-04) También la fecha límite de inscripción en `dd/mm/aaaa`, o
   «Sin fecha límite» si no tiene (FEAT-04 · RN-12; P17).
3. El sistema ofrece solo las acciones que permite el estado: en `draft`, editar, publicar, borrar y duplicar; en
   `published`, editar, cerrar y duplicar (RV-03, RV-04, RV-06, S-11).

## Flujos alternativos
- **A1 — Oferta cerrada** (desde el paso 3): la oferta está en `closed` → se muestra en solo lectura, con su fecha de
  cierre, y la única acción es duplicar (RV-03, RV-04, S-10, S-11). (FEAT-04) La fecha límite, si la tiene, se muestra
  solo como dato informativo, sin aviso de plazo vencido (FEAT-04 · RN-12; R5).
- **A2 — Plazo vencido** (desde el paso 2) (FEAT-04): la oferta está en `draft` o `published` y hoy (Europe/Madrid) es
  posterior a su fecha límite → junto a la fecha se muestra el aviso «Plazo de inscripción vencido»; las acciones del
  paso 3 no cambian (FEAT-04 · RN-11, RN-12; P17).

## Excepciones
- **E1 — Oferta inexistente** (en el paso 2): el ID no existe o la oferta se borró → 404 con el envelope de DEC-01 y un
  mensaje en la pantalla; no se muestra ningún dato.

## Reglas de negocio
- RN-05: solo se editan las ofertas `draft` y `published`.
- RN-06: transiciones `draft → published → closed`.
- RN-09: solo se borran las ofertas `draft`.
- RN-12: fechas en UTC, mostradas en Europe/Madrid.
- FEAT-04 · RN-11: el plazo no cambia el estado de la oferta.
- FEAT-04 · RN-12: la ficha muestra la fecha límite o «Sin fecha límite», con aviso de plazo vencido salvo en una
  `closed`.

## Postcondiciones
- **Éxito:** el reclutador ve la oferta; la consulta no cambia ningún dato.
- **Fallo:** no cambia ningún dato.

## Datos personales
Ninguno.

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-01 | CA-19 | `apps/web/test/features/jobs/JobDetailScreen.test.tsx:69` |
| A1 | HU-02 | CA-22 | `apps/web/test/features/jobs/JobDetailScreen.states.test.tsx:92` |
| E1 | HU-01 | CA-20 | `apps/api/test/jobs/get.test.ts:80` |
| P (FEAT-04) | HU-07 | | |
| A1 (FEAT-04) | HU-07 | | |
| A2 (FEAT-04) | HU-07 | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
