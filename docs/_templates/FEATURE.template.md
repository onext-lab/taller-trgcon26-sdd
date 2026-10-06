---
id: FEAT-NN
titulo: "<título corto>"
estado: shaping          # shaping | priorizada | en delivery | entregada
prioridad: null          # alta | media | baja (la fija la persona)
idea_origen: IDEA-NNN
modulos_afectados: []    # valores de docs/_modules.md
fecha: AAAA-MM-DD
owner: "<persona que decide>"
---

# FEAT-NN — <título>

> Análisis funcional **sin asunciones**: cada elemento cita su fuente (la persona, un doc, código `archivo:línea`).
> Lo que no tiene fuente es una pregunta abierta.

## Qué
<El resultado que se busca, en una o dos frases.>

## Por qué
<Problema u oportunidad y a quién beneficia.>

## Alcance
- **Dentro:** <qué entra>
- **Fuera:** <qué NO entra — obligatorio, evita que el alcance crezca solo>

## Actores y roles
<Quién interactúa. En el ATS hay un único rol, «reclutador» (DEC-04); el candidato no usa la aplicación.>

## Casos de uso
Cada caso de uso es un **fichero propio en el catálogo del módulo**, desde `docs/_templates/UC.template.md`
(numeración global: `node scripts/next-id.mjs uc`), con flujo principal **P**, alternativos **A1…** y excepciones
**E1…**. Aquí solo se listan, por ID y ruta desde la raíz (sin enlace relativo: la feature se mueve a `completadas/`).
Si la feature cambia un UC existente, se edita ese fichero y se marca «modificado».

| UC | Título | Módulo | Flujos | Fichero | Nuevo / modificado |
|---|---|---|---|---|---|
| UC-NN | <verbo + objeto> | <módulo> | P, A1, E1 | `docs/05_modules/{módulo}/casos-de-uso/UC-NN-slug.md` | Nuevo |

## Reglas de negocio
- **RN-01:** <«Si …, entonces …»>  _(fuente)_

## Invariantes
- **INV-01:** <«Nunca / siempre …»>  _(fuente)_

## Datos y conceptos clave
<Entidades y términos del dominio. Si hay datos personales: cuáles, para qué y cuánto tiempo (docs/RGPD.md).>

## Casos límite
<Por categoría de QUALITY-GATES.md §3 (input inválido, boundary, fallo de dependencia, concurrencia, datos corruptos,
seguridad, idempotencia): situación → comportamiento esperado.>
- **<categoría>:** <situación → comportamiento>

## Módulos afectados
<Qué cambia en cada módulo de docs/_modules.md.>

## Dependencias, riesgos y supuestos
- **Dependencias:** <features, ideas, HU previas>
- **Riesgos:** <qué puede salir mal>
- **Supuestos confirmados:** <solo los validados con la persona; los demás van a Preguntas abiertas>

## Criterios de aceptación
- [ ] <verificable, desde el punto de vista del reclutador>

## Preguntas abiertas
- **PA-01:** <pregunta + contexto + recomendación> — _Estado: abierta | respondida (fecha, respuesta) | aplazada_

## Handoff a delivery
<HU propuestas en orden de dependencias: título, criterio de valor y dependencias de cada una.>
