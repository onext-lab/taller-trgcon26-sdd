---
id: UC-NN
titulo: "<verbo + objeto, desde el punto de vista del actor>"
modulo: <candidatos | ofertas | inscripciones>
actor: reclutador
estado: borrador          # borrador | aprobado | implementado | obsoleto
feature: FEAT-NN          # feature que lo creó (o la última que lo cambió)
hus: []                   # HU que implementan alguno de sus flujos, p. ej. [HU-03]
---

# UC-NN — <título>

> Caso de uso del catálogo del módulo. Lo crea `/feature-shaping` (estado `borrador`), lo enlazan por su ID la HU,
> el PRD y la revisión, y `/module-sync` lo marca `implementado` cuando la HU que lo cubre llega a `main`.
> Cada flujo tiene un identificador estable (**P**, **A1…**, **E1…**): el PRD convierte cada uno en, al menos, un
> criterio de aceptación, y la revisión exige un test por flujo.

## Objetivo
<Qué consigue el actor, en una frase.>

## Actor y disparador
- **Actor principal:** <rol; en el ATS, «reclutador» (DEC-04)>
- **Disparador:** <qué inicia el caso>

## Precondiciones
- <estado del sistema necesario para empezar>

## Flujo principal (P)
1. <el actor …>
2. <el sistema …>
3. <…>

## Flujos alternativos
- **A1 — <nombre>** (desde el paso N): <condición> → <qué cambia y dónde vuelve o termina>

## Excepciones
- **E1 — <nombre>** (en el paso N): <error o regla incumplida> → <qué ve el actor; qué NO cambia en el sistema>

## Reglas de negocio
- <RN-NN de la feature que aplican, con su enunciado corto>

## Postcondiciones
- **Éxito:** <estado observable resultante>
- **Fallo:** <qué queda igual que antes>

## Datos personales
<Qué datos personales lee o escribe y con qué base jurídica (docs/RGPD.md). «Ninguno» si no toca.>

## Trazabilidad
| Flujo | HU | Criterio de aceptación (PRD) | Test |
|---|---|---|---|
| P | HU-NN | CA-NN | `<fichero>:<línea>` |
| A1 | | | |
| E1 | | | |

_La rellenan `/prd-writer` (CA), `/reviewer` (test) y `/module-sync` (al cerrar). Un flujo sin test es un hallazgo._
