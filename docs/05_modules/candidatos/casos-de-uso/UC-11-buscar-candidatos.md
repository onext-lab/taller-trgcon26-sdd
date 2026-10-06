---
id: UC-11
titulo: "Buscar candidatos"
modulo: candidatos
actor: reclutador
estado: aprobado
feature: FEAT-02
hus: [HU-03]
---

# UC-11 — Buscar candidatos

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
El reclutador encuentra candidatos por nombre, email o skill.

## Actor y disparador
- **Actor principal:** reclutador (DEC-04).
- **Disparador:** el reclutador abre el listado de candidatos o cambia sus filtros.

## Precondiciones
- Ninguna.

## Flujo principal (P)
1. El reclutador escribe un texto `q` en el buscador.
2. El sistema devuelve los candidatos cuyo nombre o email contienen `q`, sin distinguir mayúsculas ni tildes («jose»
   encuentra «José») (RV-14).
3. El sistema ordena por fecha de alta, la más reciente primero, y pagina de 20 en 20 (S-04, RV-08).
4. El listado muestra solo nombre, email y skills de cada candidato (S-04, RGPD §6).

## Flujos alternativos
- **A1 — Sin filtros** (desde el paso 1): sin `q` ni skill → todos los candidatos, con el mismo orden y paginación
  (S-04).
- **A2 — Filtro por skill** (desde el paso 1): el reclutador elige una sola skill → solo los candidatos con esa skill
  exacta, comparada en minúsculas; si también hay `q`, se combinan en Y (RV-14, S-04).
- **A3 — Sin resultados** (en el paso 2): ninguna coincidencia → estado vacío con mensaje (06_design_principles §3).
- **A4 — Otra página o tamaño** (en el paso 3): el reclutador pide otra página o un tamaño de página de hasta 100 →
  se devuelve esa página; una página más allá de la última devuelve una lista vacía (RV-08, S-04).

## Excepciones
- **E1 — Parámetros inválidos** (en el paso 2): `q` de más de 100 caracteres o con caracteres de control, o más de
  100 por página → 400 en el envelope, sin repetir `q` en el mensaje (S-03, S-04, RGPD §6).
- **E2 — API no disponible** (en el paso 2): la web no recibe respuesta → estado de error con opción de reintentar;
  los filtros se conservan (06_design_principles §3).

## Reglas de negocio
- RN-08 búsqueda y listado; RN-02 límites de `q`.

## Postcondiciones
- **Éxito:** el reclutador ve la página pedida de candidatos que cumplen los filtros.
- **Fallo:** no cambia nada en el sistema (operación de solo lectura).

## Datos personales
Lee nombre, email y skills, solo para la lista (minimización, RGPD §6). `q` puede contener un nombre o un email: no
se registra en los logs (RGPD §6).

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-03 | CA-15 | |
| A1 | HU-03 | CA-16 | |
| A2 | HU-03 | CA-17 | |
| A3 | HU-03 | CA-18 | |
| A4 | HU-03 | CA-19 | |
| E1 | HU-03 | CA-20, CA-32 | |
| E2 | HU-03 | CA-21 | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
